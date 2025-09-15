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
  const logger = pino(loggerConfig, prettyStream);
  loggers.set(name, logger);
  return logger;
}
function getLogger(name) {
  return loggers.get(name);
}
function clearLoggers() {
  loggers.clear();
}
function setLoggerEnabled(pattern, enabled) {
  const regex = new RegExp(pattern.replace(/\*/g, ".*"));
  loggers.forEach((logger, name) => {
    if (regex.test(name)) {
      logger.level = enabled ? logLevel : "silent";
    }
  });
}
function setupLogger(name) {
  const logger = createLogger({
    name: `test:${name}`,
    enabled: process.argv.includes("--printlogs"),
  });
  return logger;
}
export { clearLoggers, createLogger, getLogger, setLoggerEnabled, setupLogger };
//# sourceMappingURL=logger.js.map
