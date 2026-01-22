import pino from "pino";
import type { Logger } from "pino";
import pinoPretty from "pino-pretty";

export interface LoggerOptions {
  name: string;
  level?: string;
  enabled?: boolean;
}

const logLevel = process.env.LOG_LEVEL || "info";

// Create pretty stream for all contexts
const prettyStream = pinoPretty({
  colorize: true,
  translateTime: "HH:MM:ss.l",
  ignore: "pid,hostname",
  sync: true, // Important for worker threads
});

const pinoOptions: pino.LoggerOptions = {
  level: logLevel,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
};

const loggers = new Map<string, Logger>();

export function createLogger(options: LoggerOptions): Logger {
  const { name, level = logLevel, enabled = true } = options;

  const existingLogger = loggers.get(name);
  if (existingLogger) {
    return existingLogger;
  }

  const loggerConfig: pino.LoggerOptions = {
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

export function getLogger(name: string): Logger | undefined {
  return loggers.get(name);
}

export function clearLoggers(): void {
  loggers.clear();
}

// Helper function to enable/disable specific loggers
export function setLoggerEnabled(pattern: string, enabled: boolean): void {
  const regex = new RegExp(pattern.replace(/\*/g, ".*"));

  loggers.forEach((logger, name) => {
    if (regex.test(name)) {
      logger.level = enabled ? logLevel : "silent";
    }
  });
}

/**
 * Callable logger type - a function that logs at info level with access to the underlying pino Logger
 */
export interface CallableLogger {
  (message: string): void;
  /** Log at info level (alias for calling the logger directly) */
  info: (message: string) => void;
  /** The underlying pino Logger for advanced usage */
  pino: pino.Logger;
}

// Compatibility layer for the existing setupLogger function
// Returns a callable function that logs at info level
export function setupLogger(name: string): CallableLogger {
  const logger = createLogger({
    name: `test:${name}`,
    enabled: process.argv.includes("--printlogs"),
  });

  // Create a callable function that wraps logger.info
  const logFn = (message: string) => logger.info(message);
  const callableLogger = logFn as CallableLogger;

  // Attach .info as alias and the underlying pino logger
  callableLogger.info = logFn;
  callableLogger.pino = logger;

  return callableLogger;
}

// Re-export types
export type { Logger } from "pino";
