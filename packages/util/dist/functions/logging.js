// src/functions/logging.ts
import "@moonbeam-network/api-augment";

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

// src/functions/logging.ts
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
export { log, printEvents, printTokens, setupLogger2 as setupLogger };
//# sourceMappingURL=logging.js.map
