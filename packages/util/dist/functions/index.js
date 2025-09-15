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
function getLogger(name) {
  return loggers.get(name);
}
function clearLoggers() {
  loggers.clear();
}
function setLoggerEnabled(pattern, enabled) {
  const regex = new RegExp(pattern.replace(/\*/g, ".*"));
  loggers.forEach((logger2, name) => {
    if (regex.test(name)) {
      logger2.level = enabled ? logLevel : "silent";
    }
  });
}
function setupLogger(name) {
  const logger2 = createLogger({
    name: `test:${name}`,
    enabled: process.argv.includes("--printlogs"),
  });
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

// src/functions/common.ts
import "@moonbeam-network/api-augment";
import { BN } from "@polkadot/util";
function sortObjectByKeys(obj) {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = obj[key];
  }
  return sortedObj;
}
var Perthing = class {
  unit;
  perthing;
  constructor(unit, num, denom) {
    let numerator = num;
    let denominator = denom;
    if (!(numerator instanceof BN)) {
      numerator = new BN(numerator.toString());
    }
    if (denominator && !(denominator instanceof BN)) {
      denominator = new BN(denominator.toString());
    }
    this.unit = unit;
    if (denominator) {
      this.perthing = numerator.mul(unit).div(denominator);
    } else {
      this.perthing = numerator;
    }
  }
  value() {
    return this.perthing;
  }
  of(value) {
    return this.divNearest(this.perthing.mul(value), this.unit);
  }
  ofCeil(value) {
    return this.divCeil(this.perthing.mul(value), this.unit);
  }
  toString() {
    return `${this.perthing.toString()}`;
  }
  divCeil(a, num) {
    const dm = a.divmod(num);
    if (dm.mod.isZero()) return dm.div;
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  }
  divNearest(a, num) {
    const dm = a.divmod(num);
    if (dm.mod.isZero()) return dm.div;
    const mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;
    const half = num.ushrn(1);
    const r2 = num.andln(1);
    const cmp = mod.cmp(half);
    if (cmp <= 0 || (r2 === new BN(1) && cmp === 0)) return dm.div;
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  }
};
var Perbill = class extends Perthing {
  constructor(numerator, denominator) {
    super(new BN(1e9), numerator, denominator);
  }
};
var Percent = class extends Perthing {
  constructor(numerator, denominator) {
    super(new BN(100), numerator, denominator);
  }
};
function getObjectMethods(obj) {
  const properties = /* @__PURE__ */ new Set();
  let currentObj = obj;
  while (currentObj) {
    for (const item of Object.getOwnPropertyNames(currentObj)) {
      properties.add(item);
    }
    currentObj = Object.getPrototypeOf(currentObj);
  }
  return Array.from(properties).filter((item) => typeof obj[item] === "function");
}
async function directRpcRequest(endpoint, method, params = [], timeoutMs = 1e4) {
  const data = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };
  if (endpoint.startsWith("ws")) {
    console.log("you've passed a websocket to fetch, is this intended?");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const responseData = await response.json();
    if (responseData.error) {
      throw new Error(responseData.error.message);
    }
    return responseData.result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(
        `RPC request to ${endpoint} timed out after ${timeoutMs}ms (method: ${method})`
      );
    }
    throw error;
  }
}

// src/functions/contextHelpers.ts
import "@moonbeam-network/api-augment";
function filterAndApply(events, section, methods, onFound) {
  return events
    .filter(({ event }) => section === event.section && methods.includes(event.method))
    .map((record) => onFound(record));
}
function getDispatchError({
  event: {
    data: [dispatchError],
  },
}) {
  return dispatchError;
}
function getDispatchInfo({ event: { data, method } }) {
  return method === "ExtrinsicSuccess" ? data[0] : data[1];
}
function extractError(events = []) {
  return filterAndApply(events, "system", ["ExtrinsicFailed"], getDispatchError)[0];
}
function isExtrinsicSuccessful(events = []) {
  return filterAndApply(events, "system", ["ExtrinsicSuccess"], () => true).length > 0;
}
function extractInfo(events = []) {
  return filterAndApply(
    events,
    "system",
    ["ExtrinsicFailed", "ExtrinsicSuccess"],
    getDispatchInfo
  )[0];
}
function extractFee(events = []) {
  return filterAndApply(events, "balances", ["Withdraw"], ({ event }) => event.data)[0];
}

// src/functions/contracts.ts
import fs from "fs";
import path from "path";
function getAllCompiledContracts(contractsDir = "./", recurse = false) {
  const contractsPath = path.isAbsolute(contractsDir)
    ? contractsDir
    : path.join(process.cwd(), contractsDir);
  const contracts = fs.readdirSync(contractsPath, { withFileTypes: true });
  let contractNames = [];
  for (const dirent of contracts) {
    const fullDirentPath = path.join(contractsPath, dirent.name);
    if (dirent.isDirectory() && recurse) {
      contractNames = contractNames.concat(getAllCompiledContracts(fullDirentPath, recurse));
    } else if (dirent.isFile() && path.extname(dirent.name) === ".json") {
      contractNames.push(path.basename(dirent.name, ".json"));
    }
  }
  return contractNames;
}
function getCompiled(contractPath) {
  const filePath = path.join(process.cwd(), `${contractPath}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Contract name (${contractPath}) doesn't exist in test suite`);
  }
  try {
    const json = fs.readFileSync(filePath, "utf8");
    return JSON.parse(json);
  } catch (e) {
    throw new Error(
      `Contract name ${contractPath} is not compiled. Please check compiled json exists`
    );
  }
}

// src/functions/ethers.ts
import { Wallet } from "ethers";

// src/constants/accounts.ts
import "@moonbeam-network/api-augment";
import { Keyring } from "@polkadot/api";

// src/constants/chain.ts
import "@moonbeam-network/api-augment";
var DEBUG_MODE = process.env.DEBUG_MODE || false;
var DISPLAY_LOG = process.env.MOONBEAM_LOG || false;
var MOONBEAM_LOG = process.env.MOONBEAM_LOG || "info";
var BASE_PATH = process.env.BASE_PATH;
var CUSTOM_SPEC_PATH = process.env.CUSTOM_SPEC_PATH;
var BINARY_PATH = process.env.BINARY_PATH || "../target/release/moonbeam";
var RELAY_BINARY_PATH = process.env.RELAY_BINARY_PATH || "../target/release/polkadot";
var RELAY_LOG = process.env.RELAY_LOG;
var OVERRIDE_RUNTIME_PATH = process.env.OVERRIDE_RUNTIME_PATH || void 0;
var ETHAPI_CMD = process.env.ETHAPI_CMD || "";
var WASM_RUNTIME_OVERRIDES = process.env.WASM_RUNTIME_OVERRIDES || "";
var GLMR = 1000000000000000000n;
var DEFAULT_GENESIS_BALANCE = 2n ** 80n;
var DEFAULT_GENESIS_STAKING = 1000n * GLMR;
var DEFAULT_GENESIS_MAPPING = 100n * GLMR;
var PROPOSAL_AMOUNT = 1000n * GLMR;
var VOTE_AMOUNT = 10n * GLMR;
var MIN_GLMR_STAKING = 1000n * GLMR;
var MIN_GLMR_DELEGATOR = 1n * GLMR;
var WEIGHT_PER_SECOND = 1000000000000n;
var GAS_PER_SECOND = 40000000n;
var GAS_PER_WEIGHT = WEIGHT_PER_SECOND / GAS_PER_SECOND;
var GAS_PER_POV_BYTES = 4n;
var BLOCK_WEIGHT_LIMIT = WEIGHT_PER_SECOND / 2n;
var BLOCK_GAS_LIMIT = BLOCK_WEIGHT_LIMIT / GAS_PER_WEIGHT;
var EXTRINSIC_GAS_LIMIT = (BLOCK_GAS_LIMIT * 3n) / 4n - BLOCK_GAS_LIMIT / 10n;
var MAX_BLOCK_DEV_POV = 4 * 1024 * 1024 + 512;
var MAX_ETH_POV_PER_TX = EXTRINSIC_GAS_LIMIT / GAS_PER_POV_BYTES;
var EXTRINSIC_BASE_WEIGHT = 25e7;
var WEIGHT_PER_GAS = 1000000000000n / 40000000n;
var MIN_GAS_PRICE = 10000000000n;
var MINUTES = 60 / 12;
var HOURS = MINUTES * 60;
var DAYS = HOURS * 24;
var TWO_MINS = 2 * 60 * 1e3;
var FIVE_MINS = 5 * 60 * 1e3;
var TEN_MINS = 10 * 60 * 1e3;
var THIRTY_MINS = 30 * 60 * 1e3;
var ONE_HOURS = 60 * 60 * 1e3;
var TWO_HOURS = 2 * 60 * 60 * 1e3;
var THREE_HOURS = 3 * 60 * 60 * 1e3;
var FOUR_HOURS = 4 * 60 * 60 * 1e3;
var MAX_BLOCK_WEIGHT = 5e11;
var TARGET_FILL_AMOUNT =
  ((MAX_BLOCK_WEIGHT * 0.75 * 0.25 - EXTRINSIC_BASE_WEIGHT) / MAX_BLOCK_WEIGHT) * 1e9;
var TARGET_FILL_PERMILL = 0.25 * 1e6;
var WEIGHT_FEE = 50n * 1000n;

// src/constants/accounts.ts
var keyringEth = new Keyring({ type: "ethereum" });
var keyringEd25519 = new Keyring({ type: "ed25519" });
var keyringSr25519 = new Keyring({ type: "sr25519" });
var ALITH_ADDRESS = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac";
var ALITH_PRIVATE_KEY = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133";
var BALTATHAR_PRIVATE_KEY = "0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b";
var CHARLETH_PRIVATE_KEY = "0x0b6e18cafb6ed99687ec547bd28139cafdd2bffe70e6b688025de6b445aa5c5b";
var DOROTHY_PRIVATE_KEY = "0x39539ab1876910bbf3a223d84a29e28f1cb4e2e456503e7e91ed39b2e7223d68";
var ETHAN_PRIVATE_KEY = "0x7dce9bc8babb68fec1409be38c8e1a52650206a7ed90ff956ae8a6d15eeaaef4";
var FAITH_PRIVATE_KEY = "0xb9d2ea9a615f3165812e8d44de0d24da9bbd164b65c4f0573e1ce2c8dbd9c8df";
var GOLIATH_PRIVATE_KEY = "0x96b8a38e12e1a31dee1eab2fffdf9d9990045f5b37e44d8cc27766ef294acf18";
var GERALD_PRIVATE_KEY = "0x99B3C12287537E38C90A9219D4CB074A89A16E9CDB20BF85728EBD97C343E342";
var ALITH_GENESIS_FREE_BALANCE = DEFAULT_GENESIS_BALANCE - DEFAULT_GENESIS_MAPPING;
var ALITH_GENESIS_LOCK_BALANCE = DEFAULT_GENESIS_STAKING;
var ALITH_GENESIS_TRANSFERABLE_BALANCE = ALITH_GENESIS_FREE_BALANCE - ALITH_GENESIS_LOCK_BALANCE;
var alith = keyringEth.addFromUri(ALITH_PRIVATE_KEY);
var baltathar = keyringEth.addFromUri(BALTATHAR_PRIVATE_KEY);
var charleth = keyringEth.addFromUri(CHARLETH_PRIVATE_KEY);
var dorothy = keyringEth.addFromUri(DOROTHY_PRIVATE_KEY);
var ethan = keyringEth.addFromUri(ETHAN_PRIVATE_KEY);
var faith = keyringEth.addFromUri(FAITH_PRIVATE_KEY);
var goliath = keyringEth.addFromUri(GOLIATH_PRIVATE_KEY);
var gerald = keyringEth.addFromUri(GERALD_PRIVATE_KEY);

// src/functions/ethers.ts
var transactionHandlers = {
  legacy: (blob, params) => {
    blob.gasPrice = params.gasPrice || "10000000000";
    blob.gasLimit = params.gasLimit || "200000";
    blob.type = 0;
  },
  eip2930: (blob, params) => {
    blob.gasPrice = params.gasPrice || "10000000000";
    blob.gasLimit = params.gasLimit || "200000";
    blob.accessList = params.accessList || [];
    blob.type = 1;
  },
  eip1559: (blob, params) => {
    blob.accessList = params.accessList || [];
    blob.maxFeePerGas = params.maxFeePerGas || "10000000000";
    blob.maxPriorityFeePerGas = params.maxPriorityFeePerGas || 0;
    blob.gasLimit = params.gasLimit || "200000";
    blob.type = 2;
  },
};
async function createEthersTransaction(context, params) {
  const nonce =
    "nonce" in params
      ? params.nonce
      : await context.viem().getTransactionCount({ address: ALITH_ADDRESS });
  const blob = { nonce, ...params };
  const handler = transactionHandlers[params.txnType || "legacy"];
  if (!handler) {
    throw new Error("Unknown transaction type, update createRawEthersTxn fn");
  }
  handler(blob, params);
  const signer = params.privateKey
    ? new Wallet(params.privateKey, context.ethers().provider)
    : context.ethers();
  const txn = await signer.populateTransaction(blob);
  return await signer.signTransaction(txn);
}

// src/functions/extrinsics.ts
var signAndSend = async (tx, account = alith, nonce = -1) =>
  new Promise((resolve) =>
    tx.signAndSend(account, { nonce }, ({ status }) => {
      if (status.isInBlock) {
        process.stdout.write(
          "Extrinsic submitted and included in block, waiting for finalization..."
        );
      }
      if (status.isFinalized) {
        process.stdout.write("\u2705\n");
        resolve(true);
      }
    })
  );

// src/functions/jumping.ts
import "@moonbeam-network/api-augment";
import WebSocket from "ws";
async function jumpBlocksDev(polkadotJsApi, blocks) {
  let blockCount = blocks;
  while (blockCount > 0) {
    await polkadotJsApi.rpc.engine.createBlock(true, true);
    blockCount--;
  }
}
async function jumpRoundsDev(polkadotJsApi, count) {
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();
  return jumpToRoundDev(polkadotJsApi, round);
}
async function jumpToRoundDev(polkadotJsApi, round) {
  let lastBlockHash = "";
  for (;;) {
    const currentRound = (await polkadotJsApi.query.parachainStaking.round()).current.toNumber();
    if (currentRound === round) {
      return lastBlockHash;
    }
    if (currentRound > round) {
      return null;
    }
    lastBlockHash = (await polkadotJsApi.rpc.engine.createBlock(true, true)).blockHash.toString();
  }
}
async function calculateBlocks(polkadotJsApi, targetRound) {
  const roundInfo = await polkadotJsApi.query.parachainStaking.round();
  if (roundInfo.current.toNumber() >= targetRound) {
    return 0;
  }
  const roundsToJump = targetRound - roundInfo.current.toNumber();
  const heightToJump = roundInfo.first.toNumber() + roundsToJump * roundInfo.length.toNumber();
  const currentBlock = (await polkadotJsApi.rpc.chain.getHeader()).number.toNumber();
  return heightToJump - currentBlock;
}
async function jumpRoundsChopsticks(polkadotJsApi, port, count) {
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();
  return jumpToRoundChopsticks(polkadotJsApi, port, round);
}
async function jumpToRoundChopsticks(polkadotJsApi, port, round) {
  const blockToJump = await calculateBlocks(polkadotJsApi, round);
  return jumpBlocksChopsticks(port, blockToJump);
}
async function jumpBlocksChopsticks(port, blockCount) {
  return await sendNewBlockCmd(port, blockCount);
}
var sendNewBlockCmd = async (port, count = 1) => {
  const websocketUrl = `ws://127.0.0.1:${port}`;
  const socket = new WebSocket(websocketUrl);
  const result = await new Promise((resolve) => {
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "dev_newBlock",
          params: [{ count }],
        })
      );
    });
    socket.on("message", (chunk) => {
      const data = JSON.parse(chunk.toString());
      resolve(data.result);
      socket.close();
    });
  });
  return result;
};

// src/functions/logging.ts
import "@moonbeam-network/api-augment";
var setupLogger2 = setupLogger;
function log(...msg) {
  if (process.argv?.[2] && process.argv[2] === "--printlogs") {
    console.log(...msg);
  }
}
var printTokens = (api, tokens, decimals = 2, pad = 9) => {
  if (!api.registry.chainDecimals[0]) {
    throw new Error("Chain decimals not found for system token");
  }
  return `${(Math.ceil(Number(tokens / 10n ** BigInt(api.registry.chainDecimals[0] - decimals))) / 10 ** decimals).toString().padStart(pad)} ${api.registry.chainTokens[0]}`;
};
var printEvents = async (api, hash) => {
  const blockHash = hash || (await api.rpc.chain.getBlockHash()).toString();
  const apiAt = await api.at(blockHash);
  const { block } = await api.rpc.chain.getBlock(blockHash);
  const allRecords = await apiAt.query.system.events();
  const txsWithEvents = mapExtrinsics(block.extrinsics, allRecords);
  console.log(`===== Block #${block.header.number.toString()}: ${blockHash}`);
  console.log(block.header.toHuman());
  console.log(
    txsWithEvents
      .map(
        (
          { extrinsic, events },
          i
        ) => `  [${i}]: ${extrinsic.method.section.toString()}. ${extrinsic.method.method.toString()}
  - 0x${Buffer.from(extrinsic.data).toString("hex")}
${events
  .map(
    (event) => `    * ${event.section.toString()}.${event.method.toString()}:
${event.data.map((datum) => `      - ${datum.toHex()}`).join("\n")}`
  )
  .join("\n")}`
      )
      .join("\n")
  );
};

// src/functions/providers.ts
import "@moonbeam-network/api-augment";
async function customWeb3Request(web3, method, params) {
  return new Promise((resolve, reject) => {
    web3.eth.currentProvider.send(
      {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      },
      (error, result) => {
        if (error) {
          reject(
            `Failed to send custom request (${method} (${params
              .map((p) => {
                const str = p.toString();
                return str.length > 128 ? `${str.slice(0, 96)}...${str.slice(-28)}` : str;
              })
              .join(",")})): ${error.message || error.toString()}`
          );
        }
        resolve(result);
      }
    );
  });
}
async function web3EthCall(web3, options) {
  return await customWeb3Request(web3, "eth_call", [
    {
      from: options.from === void 0 ? options.from : alith.address,
      value: options.value,
      gas: options.gas === void 0 ? options.gas : 256e3,
      gasPrice: options.gas === void 0 ? options.gas : `0x${MIN_GAS_PRICE}`,
      to: options.to,
      data: options.data,
    },
  ]);
}

// src/functions/viem.ts
import { createWalletClient, hexToNumber, http } from "viem";
import { setTimeout as timer } from "timers/promises";
import { privateKeyToAccount } from "viem/accounts";
async function getDevChain(url) {
  const httpUrl = url.replace("ws", "http");
  const block = { http: [httpUrl] };
  return {
    id: 1281,
    name: "Moonbeam Dev",
    nativeCurrency: {
      decimals: 18,
      name: "Glimmer",
      symbol: "GLMR",
    },
    rpcUrls: {
      public: block,
      default: block,
    },
  };
}
async function deriveViemChain(endpoint, maxRetries = 3) {
  const httpEndpoint = endpoint.replace("ws", "http");
  const block = { http: [httpEndpoint] };
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const id = hexToNumber(await directRpcRequest(httpEndpoint, "eth_chainId", []));
      const name = await directRpcRequest(httpEndpoint, "system_chain", []);
      const { tokenSymbol, tokenDecimals } = await directRpcRequest(
        httpEndpoint,
        "system_properties",
        []
      );
      return {
        id,
        name,
        nativeCurrency: {
          decimals: tokenDecimals,
          name: tokenSymbol,
          symbol: tokenSymbol,
        },
        rpcUrls: {
          public: block,
          default: block,
        },
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        console.warn(
          `Failed to derive viem chain on attempt ${attempt}/${maxRetries}: ${error.message}. Retrying...`
        );
        await timer(1e3 * attempt);
      }
    }
  }
  throw new Error(
    `Failed to derive viem chain after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
}
async function deployViemContract(context, abi, bytecode, options) {
  const url = context.viem().transport.url;
  const { privateKey = ALITH_PRIVATE_KEY, ...rest } = options || {};
  const blob = {
    ...rest,
    abi,
    bytecode,
    account: privateKeyToAccount(privateKey),
  };
  const account = privateKeyToAccount(ALITH_PRIVATE_KEY);
  const client = createWalletClient({
    transport: http(url),
    account,
    chain: await deriveViemChain(url),
  });
  const hash = await client.deployContract(blob);
  await context.createBlock();
  for (let i = 0; i < 5; i++) {
    try {
      const { contractAddress, status, logs } = await context
        .viem()
        .getTransactionReceipt({ hash });
      return { contractAddress, status, logs, hash };
    } catch (e) {
      console.log(e.message);
      console.log("Contract deployment query, retrying...");
      await timer(100);
    }
  }
  throw new Error("Contract deployment query failed after 5 retries");
}
async function createRawTransfer(context, to, value, options) {
  const transferAmount = typeof value === "bigint" ? value : BigInt(value);
  return await createViemTransaction(context, {
    ...options,
    to,
    value: transferAmount,
  });
}
async function createViemTransaction(context, options) {
  const type = !!options && !!options.txnType ? options.txnType : "eip1559";
  const privateKey = !!options && !!options.privateKey ? options.privateKey : ALITH_PRIVATE_KEY;
  const account = privateKeyToAccount(privateKey);
  const value = options?.value ? options.value : 0n;
  const to = options?.to ? options.to : "0x0000000000000000000000000000000000000000";
  const chainId = await context.viem().getChainId();
  const txnCount = await context.viem().getTransactionCount({ address: account.address });
  const gasPrice = await context.viem().getGasPrice();
  const data = options?.data ? options.data : "0x";
  const estimatedGas =
    options.skipEstimation || options.gas !== void 0
      ? 1500000n
      : await context.viem().estimateGas({ account: account.address, to, value, data });
  const accessList = options?.accessList ? options.accessList : [];
  const txnBlob =
    type === "eip1559"
      ? {
          to,
          value,
          maxFeePerGas: options.maxFeePerGas !== void 0 ? options.maxFeePerGas : gasPrice,
          maxPriorityFeePerGas:
            options.maxPriorityFeePerGas !== void 0 ? options.maxPriorityFeePerGas : gasPrice,
          gas: options.gas !== void 0 ? options.gas : estimatedGas,
          nonce: options.nonce !== void 0 ? options.nonce : txnCount,
          data,
          chainId,
          type,
        }
      : type === "legacy"
        ? {
            to,
            value,
            gasPrice: options.gasPrice !== void 0 ? options.gasPrice : gasPrice,
            gas: options.gas !== void 0 ? options.gas : estimatedGas,
            nonce: options.nonce !== void 0 ? options.nonce : txnCount,
            data,
          }
        : type === "eip2930"
          ? {
              to,
              value,
              gasPrice: options.gasPrice !== void 0 ? options.gasPrice : gasPrice,
              gas: options.gas !== void 0 ? options.gas : estimatedGas,
              nonce: options.nonce !== void 0 ? options.nonce : txnCount,
              data,
              chainId,
              type,
            }
          : {};
  if (
    (type === "eip1559" && accessList.length > 0) ||
    (type === "eip2930" && accessList.length > 0)
  ) {
    txnBlob.accessList = accessList;
  }
  return await account.signTransaction(txnBlob);
}
async function checkBalance(context, account = ALITH_ADDRESS, block = "latest") {
  return typeof block === "string"
    ? await context.viem().getBalance({ address: account, blockTag: block })
    : typeof block === "bigint"
      ? await context.viem().getBalance({ address: account, blockNumber: block })
      : await context.viem().getBalance({ address: account });
}
async function sendRawTransaction(context, rawTx) {
  return await context.viem().request({ method: "eth_sendRawTransaction", params: [rawTx] });
}
export {
  Perbill,
  Percent,
  calculateFeePortions,
  checkBalance,
  checkBlockFinalized,
  checkTimeSliceForUpgrades,
  clearLoggers,
  createAndFinalizeBlock,
  createEthersTransaction,
  createLogger,
  createRawTransfer,
  createViemTransaction,
  customWeb3Request,
  deployViemContract,
  deriveViemChain,
  directRpcRequest,
  extractError,
  extractFee,
  extractInfo,
  extractPreimageDeposit,
  extractWeight,
  fetchHistoricBlockNum,
  filterAndApply,
  getAllCompiledContracts,
  getBlockArray,
  getBlockExtrinsic,
  getBlockTime,
  getCompiled,
  getDevChain,
  getDispatchError,
  getLogger,
  getObjectMethods,
  isExtrinsicSuccessful,
  jumpBlocksChopsticks,
  jumpBlocksDev,
  jumpRoundsChopsticks,
  jumpRoundsDev,
  jumpToRoundChopsticks,
  jumpToRoundDev,
  log,
  mapExtrinsics,
  printEvents,
  printTokens,
  sendRawTransaction,
  setLoggerEnabled,
  setupLogger2 as setupLogger,
  signAndSend,
  sortObjectByKeys,
  web3EthCall,
};
//# sourceMappingURL=index.js.map
