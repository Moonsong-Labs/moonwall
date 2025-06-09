import pino from "pino";
import type { Logger } from "pino";

export interface LoggerOptions {
  name: string;
  level?: string;
  enabled?: boolean;
}

const logLevel = process.env.LOG_LEVEL || "info";

const pinoOptions: pino.LoggerOptions = {
  level: logLevel,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss.l",
      ignore: "pid,hostname",
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

  const logger = pino({
    name,
    level,
    enabled,
    formatters: pinoOptions.formatters,
    transport: pinoOptions.transport,
  });

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

// Compatibility layer for the existing setupLogger function
export function setupLogger(name: string): pino.Logger {
  const logger = createLogger({
    name: `test:${name}`,
    enabled: process.argv.includes("--printlogs"),
  });

  return logger;
}

// Re-export types
export type { Logger } from "pino";
