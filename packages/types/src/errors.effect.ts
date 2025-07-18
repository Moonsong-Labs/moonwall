import { Data } from "effect";

/**
 * Base error class for all Moonwall errors using Effect's Data.TaggedError
 */
export class MoonwallError extends Data.TaggedError("MoonwallError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Network-related errors (connection failures, timeouts, etc.)
 */
export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
  readonly endpoint: string;
  readonly operation: string;
  readonly cause?: unknown;
}> {}

/**
 * Resource management errors (acquisition, release, usage failures)
 */
export class ResourceError extends Data.TaggedError("ResourceError")<{
  readonly message: string;
  readonly resource: string;
  readonly operation: "acquire" | "release" | "use";
  readonly cause?: unknown;
}> {}

/**
 * Configuration-related errors (invalid config, missing fields, etc.)
 */
export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
  readonly message: string;
  readonly field: string;
  readonly value: unknown;
  readonly cause?: unknown;
}> {}

/**
 * Timeout errors for operations that exceed time limits
 */
export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly message: string;
  readonly operation: string;
  readonly timeout: number;
  readonly cause?: unknown;
}> {}

/**
 * Validation errors for invalid input data
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly field: string;
  readonly value: unknown;
  readonly expected: string;
  readonly cause?: unknown;
}> {}

/**
 * Process management errors (spawn, kill, communication failures)
 */
export class ProcessError extends Data.TaggedError("ProcessError")<{
  readonly message: string;
  readonly process: string;
  readonly operation: "spawn" | "kill" | "communicate" | "wait";
  readonly exitCode?: number;
  readonly cause?: unknown;
}> {}

/**
 * Docker-related errors (container management, image operations, etc.)
 */
export class DockerError extends Data.TaggedError("DockerError")<{
  readonly message: string;
  readonly container?: string;
  readonly image?: string;
  readonly operation: string;
  readonly cause?: unknown;
}> {}

/**
 * Union type of all Moonwall error types for comprehensive error handling
 */
export type MoonwallErrors =
  | MoonwallError
  | NetworkError
  | ResourceError
  | ConfigurationError
  | TimeoutError
  | ValidationError
  | ProcessError
  | DockerError;

/**
 * Type guard to check if an error is a Moonwall error
 */
export const isMoonwallError = (error: unknown): error is MoonwallErrors => {
  return (
    error instanceof MoonwallError ||
    error instanceof NetworkError ||
    error instanceof ResourceError ||
    error instanceof ConfigurationError ||
    error instanceof TimeoutError ||
    error instanceof ValidationError ||
    error instanceof ProcessError ||
    error instanceof DockerError
  );
};

/**
 * Helper function to create a MoonwallError from an unknown error
 */
export const toMoonwallError = (error: unknown, message?: string): MoonwallError => {
  if (error instanceof MoonwallError) {
    return error;
  }

  return new MoonwallError({
    message: message || (error instanceof Error ? error.message : "Unknown error"),
    cause: error,
  });
};
