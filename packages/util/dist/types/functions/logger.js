import pino from "pino";
import pinoPretty from "pino-pretty";
const logLevel = process.env.LOG_LEVEL || "info";
// Create pretty stream for all contexts
const prettyStream = pinoPretty({
  colorize: true,
  translateTime: "HH:MM:ss.l",
  ignore: "pid,hostname",
  sync: true, // Important for worker threads
});
const pinoOptions = {
  level: logLevel,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
};
const loggers = new Map();
export function createLogger(options) {
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
  // Create logger with pretty stream
  const logger = pino(loggerConfig, prettyStream);
  loggers.set(name, logger);
  return logger;
}
export function getLogger(name) {
  return loggers.get(name);
}
export function clearLoggers() {
  loggers.clear();
}
// Helper function to enable/disable specific loggers
export function setLoggerEnabled(pattern, enabled) {
  const regex = new RegExp(pattern.replace(/\*/g, ".*"));
  loggers.forEach((logger, name) => {
    if (regex.test(name)) {
      logger.level = enabled ? logLevel : "silent";
    }
  });
}
// Compatibility layer for the existing setupLogger function
export function setupLogger(name) {
  const logger = createLogger({
    name: `test:${name}`,
    enabled: process.argv.includes("--printlogs"),
  });
  return logger;
}
//# sourceMappingURL=logger.js.map
