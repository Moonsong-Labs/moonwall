/**
 * loggerEffect.ts - Effect-based wrappers for pino logging functions.
 *
 * Provides Effect versions of the logger operations from logger.ts,
 * enabling typed error handling and composition within Effect pipelines.
 * The original Promise-based functions remain unchanged for backwards compatibility.
 */

import { Context, Data, Effect, Layer, Ref } from "effect";
import type { Logger as PinoLogger } from "pino";
import {
  createLogger as createLoggerSync,
  getLogger as getLoggerSync,
  clearLoggers as clearLoggersSync,
  setLoggerEnabled as setLoggerEnabledSync,
  type LoggerOptions,
} from "./logger.js";

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error when logger creation fails.
 */
export class LoggerCreationError extends Data.TaggedError("LoggerCreationError")<{
  readonly message: string;
  readonly loggerName: string;
  readonly cause?: unknown;
}> {}

// ============================================================================
// Types
// ============================================================================

/**
 * Log level type matching pino's standard levels.
 */
export type LogLevel = "silent" | "fatal" | "error" | "warn" | "info" | "debug" | "trace";

/**
 * Configuration for the LoggerService.
 */
export interface LoggerServiceConfig {
  /** Default log level for new loggers */
  readonly defaultLevel?: LogLevel;
  /** Global enabled state */
  readonly enabled?: boolean;
}

/**
 * Status of the LoggerService.
 */
export type LoggerServiceStatus =
  | { readonly _tag: "Active"; readonly loggerCount: number; readonly defaultLevel: LogLevel }
  | { readonly _tag: "Disabled" };

/**
 * A logger instance with typed logging methods.
 */
export interface LoggerInstance {
  readonly name: string;
  readonly level: LogLevel;
  readonly enabled: boolean;
  readonly debug: (message: string, context?: Record<string, unknown>) => void;
  readonly info: (message: string, context?: Record<string, unknown>) => void;
  readonly warn: (message: string, context?: Record<string, unknown>) => void;
  readonly error: (message: string, context?: Record<string, unknown>) => void;
  readonly fatal: (message: string, context?: Record<string, unknown>) => void;
  readonly trace: (message: string, context?: Record<string, unknown>) => void;
}

/**
 * Logger service interface for Effect dependency injection.
 */
export interface LoggerServiceType {
  /**
   * Create or retrieve a named logger.
   * Loggers are cached by name to prevent duplicate instances.
   */
  readonly getLogger: (
    options: LoggerOptions
  ) => Effect.Effect<LoggerInstance, LoggerCreationError>;

  /**
   * Log at debug level.
   */
  readonly debug: (
    loggerName: string,
    message: string,
    context?: Record<string, unknown>
  ) => Effect.Effect<void>;

  /**
   * Log at info level.
   */
  readonly info: (
    loggerName: string,
    message: string,
    context?: Record<string, unknown>
  ) => Effect.Effect<void>;

  /**
   * Log at warn level.
   */
  readonly warn: (
    loggerName: string,
    message: string,
    context?: Record<string, unknown>
  ) => Effect.Effect<void>;

  /**
   * Log at error level.
   */
  readonly error: (
    loggerName: string,
    message: string,
    context?: Record<string, unknown>
  ) => Effect.Effect<void>;

  /**
   * Get the current status of the logging service.
   */
  readonly getStatus: () => Effect.Effect<LoggerServiceStatus>;

  /**
   * Enable or disable loggers matching a pattern.
   * Pattern uses glob-style matching (e.g., "test:*" matches all test loggers).
   */
  readonly setLoggerEnabled: (pattern: string, enabled: boolean) => Effect.Effect<void>;

  /**
   * Clear all cached loggers.
   */
  readonly clearLoggers: () => Effect.Effect<void>;

  /**
   * Check if a logger with the given name exists.
   */
  readonly hasLogger: (name: string) => Effect.Effect<boolean>;

  /**
   * Get the names of all cached loggers.
   */
  readonly getLoggerNames: () => Effect.Effect<ReadonlyArray<string>>;
}

// ============================================================================
// Context Tag
// ============================================================================

/**
 * LoggerService Context.Tag for Effect dependency injection.
 */
export class LoggerService extends Context.Tag("@moonwall/util/LoggerService")<
  LoggerService,
  LoggerServiceType
>() {}

// ============================================================================
// Effect-based Functions (Direct wrappers)
// ============================================================================

/**
 * Effect version of createLogger.
 * Creates a pino logger with the given options, wrapped in Effect.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function* () {
 *   const logger = yield* createLoggerEffect({ name: "myLogger" });
 *   logger.info("Hello from Effect!");
 * });
 * ```
 */
export function createLoggerEffect(
  options: LoggerOptions
): Effect.Effect<LoggerInstance, LoggerCreationError> {
  return Effect.try({
    try: () => {
      const pinoLogger = createLoggerSync(options);
      return pinoToLoggerInstance(pinoLogger, options);
    },
    catch: (error) =>
      new LoggerCreationError({
        message: `Failed to create logger "${options.name}": ${error instanceof Error ? error.message : String(error)}`,
        loggerName: options.name,
        cause: error,
      }),
  });
}

/**
 * Effect version of getLogger.
 * Retrieves an existing logger by name, returning Option semantics.
 */
export function getLoggerEffect(name: string): Effect.Effect<LoggerInstance | undefined> {
  return Effect.sync(() => {
    const pinoLogger = getLoggerSync(name);
    if (!pinoLogger) return undefined;
    return pinoToLoggerInstance(pinoLogger, { name });
  });
}

/**
 * Effect version of clearLoggers.
 * Clears all cached loggers.
 */
export function clearLoggersEffect(): Effect.Effect<void> {
  return Effect.sync(() => clearLoggersSync());
}

/**
 * Effect version of setLoggerEnabled.
 * Enables or disables loggers matching a pattern.
 */
export function setLoggerEnabledEffect(pattern: string, enabled: boolean): Effect.Effect<void> {
  return Effect.sync(() => setLoggerEnabledSync(pattern, enabled));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a pino logger to our LoggerInstance interface.
 */
function pinoToLoggerInstance(pinoLogger: PinoLogger, options: LoggerOptions): LoggerInstance {
  const logWithContext =
    (method: "debug" | "info" | "warn" | "error" | "fatal" | "trace") =>
    (message: string, context?: Record<string, unknown>) => {
      if (context) {
        pinoLogger[method](context, message);
      } else {
        pinoLogger[method](message);
      }
    };

  return {
    name: options.name,
    level: (pinoLogger.level as LogLevel) || options.level || "info",
    enabled: pinoLogger.isLevelEnabled("info"),
    debug: logWithContext("debug"),
    info: logWithContext("info"),
    warn: logWithContext("warn"),
    error: logWithContext("error"),
    fatal: logWithContext("fatal"),
    trace: logWithContext("trace"),
  };
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Internal state for the LoggerService.
 */
interface LoggerServiceState {
  readonly enabled: boolean;
  readonly defaultLevel: LogLevel;
  readonly loggerNames: Set<string>;
}

/**
 * Create the LoggerService implementation.
 */
function makeLoggerServiceImpl(stateRef: Ref.Ref<LoggerServiceState>): LoggerServiceType {
  return {
    getLogger: (options: LoggerOptions) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);

        // If service is disabled, return a no-op logger
        if (!state.enabled) {
          return {
            name: options.name,
            level: "silent" as LogLevel,
            enabled: false,
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            fatal: () => {},
            trace: () => {},
          } satisfies LoggerInstance;
        }

        const loggerOptions: LoggerOptions = {
          name: options.name,
          level: options.level || state.defaultLevel,
          enabled: options.enabled ?? true,
        };

        const result = yield* createLoggerEffect(loggerOptions);

        // Track the logger name
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          loggerNames: new Set([...s.loggerNames, options.name]),
        }));

        return result;
      }),

    debug: (loggerName: string, message: string, context?: Record<string, unknown>) =>
      Effect.sync(() => {
        const logger = getLoggerSync(loggerName);
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
        const logger = getLoggerSync(loggerName);
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
        const logger = getLoggerSync(loggerName);
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
        const logger = getLoggerSync(loggerName);
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
        setLoggerEnabledSync(pattern, enabled);
      }),

    clearLoggers: () =>
      Effect.gen(function* () {
        clearLoggersSync();
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

// ============================================================================
// Layers
// ============================================================================

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
