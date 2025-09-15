// src/functions/block.ts
import "@moonbeam-network/api-augment";
import Bottleneck from "bottleneck";

// src/functions/logger.ts
import pino from "pino";
import pinoPretty from "pino-pretty";
var logLevel = process.env.LOG_LEVEL || "info";
var prettyStream = pinoPretty({
  colorize: true,
  translateTime: "HH:MM:ss.l",
  ignore: "pid,hostname",
  sync: true,
  // Important for worker threads
});
var pinoOptions = {
  level: logLevel,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
};
var loggers = /* @__PURE__ */ new Map();
function createLogger(options) {
  const { name, level = logLevel, enabled = true } = options;
  const existingLogger = loggers.get(name);
  if (existingLogger) {
    return existingLogger;
  }
  const loggerConfig = {
    name,
    level,
    enabled,
    formatters: pinoOptions.formatters,
  };
  const logger2 = pino(loggerConfig, prettyStream);
  loggers.set(name, logger2);
  return logger2;
}

// src/functions/block.ts
var logger = createLogger({ name: "test:blocks" });
var debug = logger.debug.bind(logger);
async function createAndFinalizeBlock(api, parentHash, finalize = false) {
  const startTime = Date.now();
  const block = parentHash
    ? await api.rpc("engine_createBlock", true, finalize, parentHash)
    : await api.rpc("engine_createBlock", true, finalize);
  return {
    duration: Date.now() - startTime,
    hash: block.hash,
    // toString doesn't work for block hashes
    proofSize: block.proof_size,
    // TODO: casting can be removed once api-augment is updated
  };
}
function calculateFeePortions(amount) {
  const burnt = (amount * 80n) / 100n;
  return { burnt, treasury: amount - burnt };
}
var getBlockExtrinsic = async (api, blockHash, section, method) => {
  const apiAt = await api.at(blockHash);
  const [{ block }, records] = await Promise.all([
    api.rpc.chain.getBlock(blockHash),
    apiAt.query.system.events(),
  ]);
  const extIndex = block.extrinsics.findIndex(
    (ext) => ext.method.section === section && ext.method.method === method
  );
  const extrinsic = extIndex > -1 ? block.extrinsics[extIndex] : null;
  const events = records
    .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extIndex))
    .map(({ event }) => event);
  const resultEvent = events.find(
    (event) =>
      event.section === "system" &&
      (event.method === "ExtrinsicSuccess" || event.method === "ExtrinsicFailed")
  );
  return { block, extrinsic, events, resultEvent };
};
var getBlockTime = (signedBlock) =>
  signedBlock.block.extrinsics
    .find((item) => item.method.section === "timestamp")
    .method.args[0].toNumber();
var checkBlockFinalized = async (api, number) => {
  return {
    number,
    //@ts-expect-error - remove once pJs exposes this
    finalized: await api._rpcCore.provider.send("moon_isBlockFinalized", [
      await api.rpc.chain.getBlockHash(number),
    ]),
  };
};
var fetchBlockTime = async (api, blockNum) => {
  const hash = await api.rpc.chain.getBlockHash(blockNum);
  const block = await api.rpc.chain.getBlock(hash);
  return getBlockTime(block);
};
var fetchHistoricBlockNum = async (api, blockNumber, targetTime) => {
  if (blockNumber <= 1) {
    return 1;
  }
  const time = await fetchBlockTime(api, blockNumber);
  if (time <= targetTime) {
    return blockNumber;
  }
  return fetchHistoricBlockNum(api, blockNumber - Math.ceil((time - targetTime) / 3e4), targetTime);
};
var getBlockArray = async (api, timePeriod, bottleneck) => {
  let limiter = bottleneck;
  if (!limiter) {
    limiter = new Bottleneck({ maxConcurrent: 10, minTime: 100 });
  }
  const finalizedHead = await limiter.schedule(() => api.rpc.chain.getFinalizedHead());
  const signedBlock = await limiter.schedule(() => api.rpc.chain.getBlock(finalizedHead));
  const lastBlockNumber = signedBlock.block.header.number.toNumber();
  const lastBlockTime = getBlockTime(signedBlock);
  const firstBlockTime = lastBlockTime - timePeriod;
  debug(`Searching for the block at: ${new Date(firstBlockTime)}`);
  const firstBlockNumber = await limiter.wrap(fetchHistoricBlockNum)(
    api,
    lastBlockNumber,
    firstBlockTime
  );
  const length = lastBlockNumber - firstBlockNumber;
  return Array.from({ length }, (_, i) => firstBlockNumber + i);
};
function extractWeight(weightV1OrV2) {
  if ("isSome" in weightV1OrV2) {
    const weight = weightV1OrV2.unwrap();
    if ("refTime" in weight) {
      return weight.refTime.unwrap();
    }
    return weight;
  }
  if ("refTime" in weightV1OrV2) {
    return weightV1OrV2.refTime.unwrap();
  }
  return weightV1OrV2;
}
function extractPreimageDeposit(request) {
  const deposit = "deposit" in request ? request.deposit : request;
  if ("isSome" in deposit && deposit.isSome) {
    return {
      accountId: deposit.unwrap()[0].toHex(),
      amount: deposit.unwrap()[1],
    };
  }
  if ("isNone" in deposit && deposit.isNone) {
    return void 0;
  }
  return {
    accountId: deposit[0].toHex(),
    amount: deposit[1],
  };
}
function mapExtrinsics(extrinsics, records, fees) {
  return extrinsics.map((extrinsic, index) => {
    let dispatchError;
    let dispatchInfo;
    const events = records
      .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
      .map(({ event }) => {
        if (event.section === "system") {
          if (event.method === "ExtrinsicSuccess") {
            dispatchInfo = event.data[0];
          } else if (event.method === "ExtrinsicFailed") {
            dispatchError = event.data[0];
            dispatchInfo = event.data[1];
          }
        }
        return event;
      });
    return {
      dispatchError,
      dispatchInfo,
      events,
      extrinsic,
      fee: fees ? fees[index] : void 0,
    };
  });
}
async function checkTimeSliceForUpgrades(api, blockNumbers, currentVersion) {
  const apiAt = await api.at(await api.rpc.chain.getBlockHash(blockNumbers[0]));
  const onChainRt = (await apiAt.query.system.lastRuntimeUpgrade()).unwrap().specVersion;
  return { result: !onChainRt.eq(currentVersion), specVersion: onChainRt };
}
export {
  calculateFeePortions,
  checkBlockFinalized,
  checkTimeSliceForUpgrades,
  createAndFinalizeBlock,
  extractPreimageDeposit,
  extractWeight,
  fetchHistoricBlockNum,
  getBlockArray,
  getBlockExtrinsic,
  getBlockTime,
  mapExtrinsics,
};
//# sourceMappingURL=block.js.map
