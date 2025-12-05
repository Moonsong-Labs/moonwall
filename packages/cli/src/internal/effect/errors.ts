import { Data } from "effect";

/**
 * Error thrown when port discovery fails
 */
export class PortDiscoveryError extends Data.TaggedError("PortDiscoveryError")<{
  readonly cause: unknown;
  readonly pid: number;
  readonly attempts: number;
}> {}

/**
 * Error thrown when node launch fails
 */
export class NodeLaunchError extends Data.TaggedError("NodeLaunchError")<{
  readonly cause: unknown;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}> {}

/**
 * Error thrown when node readiness check fails
 */
export class NodeReadinessError extends Data.TaggedError("NodeReadinessError")<{
  readonly cause: unknown;
  readonly port: number;
  readonly attemptsExhausted: number;
}> {}

/**
 * Error thrown when process operations fail
 */
export class ProcessError extends Data.TaggedError("ProcessError")<{
  readonly cause: unknown;
  readonly pid?: number;
  readonly operation: "spawn" | "kill" | "check";
}> {}

/**
 * Error thrown when startup cache operations fail
 */
export class StartupCacheError extends Data.TaggedError("StartupCacheError")<{
  readonly cause: unknown;
  readonly operation: "hash" | "precompile" | "cache" | "lock" | "chainspec";
}> {}
