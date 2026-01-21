/**
 * LoggerServiceLive - Effect Layer implementation wrapping pino logger.
 *
 * This implementation wraps the existing createLogger/getLogger/etc. functions
 * from @moonwall/util to provide an Effect-based logging interface.
 */

import { Effect, Layer, Ref } from "effect";
import {
  createLogger,
  getLogger as getExistingLogger,
  clearLoggers as clearExistingLoggers,
  setLoggerEnabled as setExistingLoggerEnabled,
} from "@moonwall/util";
import type { Logger as PinoLogger } from "pino";
import {
  LoggerService,
  LoggerCreationError,
  type LoggerServiceType,
  type LoggerConfig,
  type LoggerInstance,
  type LoggerServiceConfig,
  type LogLevel,
} from "./LoggerService.js";

/**
 * Internal state for the LoggerService.
 */
interface LoggerServiceState {
  readonly enabled: boolean;
  readonly defaultLevel: LogLevel;
  readonly loggerNames: Set<string>;
}

/**
 * Convert a pino logger to our LoggerInstance interface.
 */
function pinoToLoggerInstance(pinoLogger: PinoLogger, config: LoggerConfig): LoggerInstance {
  return {
    name: config.name,
    level: (pinoLogger.level as LogLevel) || config.level || "info",
    enabled: pinoLogger.isLevelEnabled("info"),
    debug: (message: string, context?: Record<string, unknown>) => {
      if (context) {
        pinoLogger.debug(context, message);
      } else {
        pinoLogger.debug(message);
      }
    },
    info: (message: string, context?: Record<string, unknown>) => {
      if (context) {
        pinoLogger.info(context, message);
      } else {
        pinoLogger.info(message);
      }
    },
    warn: (message: string, context?: Record<string, unknown>) => {
      if (context) {
        pinoLogger.warn(context, message);
      } else {
        pinoLogger.warn(message);
      }
    },
    error: (message: string, context?: Record<string, unknown>) => {
      if (context) {
        pinoLogger.error(context, message);
      } else {
        pinoLogger.error(message);
      }
    },
  };
}

/**
 * Create the LoggerService implementation.
 */
function makeLoggerServiceImpl(stateRef: Ref.Ref<LoggerServiceState>): LoggerServiceType {
  return {
    getLogger: (config: LoggerConfig) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);

        // If service is disabled, return a no-op logger
        if (!state.enabled) {
          return {
            name: config.name,
            level: "silent" as LogLevel,
            enabled: false,
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
          } satisfies LoggerInstance;
        }

        // Try to create or retrieve the logger
        const result = yield* Effect.try({
          try: () =>
            createLogger({
              name: config.name,
              level: config.level || state.defaultLevel,
              enabled: config.enabled ?? true,
            }),
          catch: (error) =>
            new LoggerCreationError({
              message: `Failed to create logger "${config.name}"`,
              loggerName: config.name,
              cause: error,
            }),
        });

        // Track the logger name
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          loggerNames: new Set([...s.loggerNames, config.name]),
        }));

        return pinoToLoggerInstance(result, config);
      }),

    debug: (loggerName: string, message: string, context?: Record<string, unknown>) =>
      Effect.sync(() => {
        const logger = getExistingLogger(loggerName);
        if (logger) {
          if (context) {
            logger.debug(context, message);
          } else {
            logger.debug(message);
          }
        }
      }),

    info: (loggerName: string, message: string, context?: Record<string, unknown>) =>
      Effect.sync(() => {
        const logger = getExistingLogger(loggerName);
        if (logger) {
          if (context) {
            logger.info(context, message);
          } else {
            logger.info(message);
          }
        }
      }),

    warn: (loggerName: string, message: string, context?: Record<string, unknown>) =>
      Effect.sync(() => {
        const logger = getExistingLogger(loggerName);
        if (logger) {
          if (context) {
            logger.warn(context, message);
          } else {
            logger.warn(message);
          }
        }
      }),

    error: (loggerName: string, message: string, context?: Record<string, unknown>) =>
      Effect.sync(() => {
        const logger = getExistingLogger(loggerName);
        if (logger) {
          if (context) {
            logger.error(context, message);
          } else {
            logger.error(message);
          }
        }
      }),

    getStatus: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);

        if (!state.enabled) {
          return { _tag: "Disabled" } as const;
        }

        return {
          _tag: "Active",
          loggerCount: state.loggerNames.size,
          defaultLevel: state.defaultLevel,
        } as const;
      }),

    setLoggerEnabled: (pattern: string, enabled: boolean) =>
      Effect.sync(() => {
        setExistingLoggerEnabled(pattern, enabled);
      }),

    clearLoggers: () =>
      Effect.gen(function* () {
        clearExistingLoggers();
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          loggerNames: new Set<string>(),
        }));
      }),

    hasLogger: (name: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return state.loggerNames.has(name);
      }),

    getLoggerNames: () =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        return Array.from(state.loggerNames);
      }),
  };
}

/**
 * LoggerServiceLive Layer - production implementation wrapping pino.
 */
export const LoggerServiceLive: Layer.Layer<LoggerService> = Layer.effect(
  LoggerService,
  Effect.gen(function* () {
    const defaultLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

    const stateRef = yield* Ref.make<LoggerServiceState>({
      enabled: true,
      defaultLevel,
      loggerNames: new Set(),
    });

    return makeLoggerServiceImpl(stateRef);
  })
);

/**
 * Create a LoggerService Layer with custom configuration.
 */
export function makeLoggerServiceLayer(config?: LoggerServiceConfig): Layer.Layer<LoggerService> {
  return Layer.effect(
    LoggerService,
    Effect.gen(function* () {
      const defaultLevel = config?.defaultLevel || (process.env.LOG_LEVEL as LogLevel) || "info";
      const enabled = config?.enabled ?? true;

      const stateRef = yield* Ref.make<LoggerServiceState>({
        enabled,
        defaultLevel,
        loggerNames: new Set(),
      });

      return makeLoggerServiceImpl(stateRef);
    })
  );
}

/**
 * Create a disabled LoggerService Layer for testing (no-op logging).
 */
export const LoggerServiceDisabled: Layer.Layer<LoggerService> = makeLoggerServiceLayer({
  enabled: false,
});
