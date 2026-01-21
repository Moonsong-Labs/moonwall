/**
 * LoggerService - Effect-based logging service wrapping pino.
 *
 * Provides a structured, type-safe logging interface that integrates
 * with the existing pino-based logging infrastructure while enabling
 * Effect-based dependency injection and testing.
 */

import { Context, Data, type Effect } from "effect";

/**
 * Log level type matching pino's standard levels.
 */
export type LogLevel = "silent" | "fatal" | "error" | "warn" | "info" | "debug" | "trace";

/**
 * Tagged error for logger creation failures.
 */
export class LoggerCreationError extends Data.TaggedError("LoggerCreationError")<{
  readonly message: string;
  readonly loggerName?: string;
  readonly cause?: unknown;
}> {}

/**
 * Configuration for creating a logger instance.
 */
export interface LoggerConfig {
  /** Name of the logger (used for identifying log source) */
  readonly name: string;
  /** Log level - defaults to LOG_LEVEL env var or "info" */
  readonly level?: LogLevel;
  /** Whether the logger is enabled - defaults to true */
  readonly enabled?: boolean;
}

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
 * LoggerService interface - provides structured logging operations.
 *
 * This service wraps the existing pino-based logging infrastructure
 * while providing Effect-based interfaces for testability and composition.
 */
export interface LoggerServiceType {
  /**
   * Create or retrieve a named logger.
   * Loggers are cached by name to prevent duplicate instances.
   */
  readonly getLogger: (config: LoggerConfig) => Effect.Effect<LoggerInstance, LoggerCreationError>;

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

/**
 * A logger instance returned by getLogger.
 * Provides direct logging methods for convenience.
 */
export interface LoggerInstance {
  readonly name: string;
  readonly level: LogLevel;
  readonly enabled: boolean;
  readonly debug: (message: string, context?: Record<string, unknown>) => void;
  readonly info: (message: string, context?: Record<string, unknown>) => void;
  readonly warn: (message: string, context?: Record<string, unknown>) => void;
  readonly error: (message: string, context?: Record<string, unknown>) => void;
}

/**
 * LoggerService Context.Tag for Effect dependency injection.
 */
export class LoggerService extends Context.Tag("LoggerService")<
  LoggerService,
  LoggerServiceType
>() {}
