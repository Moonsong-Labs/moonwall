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

/**
 * Error thrown when file lock operations fail
 */
export class FileLockError extends Data.TaggedError("FileLockError")<{
  readonly reason: "timeout" | "acquisition_failed";
  readonly lockPath: string;
}> {}

/**
 * Error thrown when test execution (vitest startup) fails
 */
export class TestExecutionError extends Data.TaggedError("TestExecutionError")<{
  readonly cause: unknown;
  readonly environment: string;
}> {}

/**
 * Error thrown when a required binary is not found on disk
 */
export class BinaryNotFoundError extends Data.TaggedError("BinaryNotFoundError")<{
  readonly path: string;
  readonly message: string;
}> {}

/**
 * Error thrown when binary architecture doesn't match the system
 */
export class BinaryArchMismatchError extends Data.TaggedError("BinaryArchMismatchError")<{
  readonly binaryArch: string;
  readonly systemArch: string;
  readonly path: string;
}> {}

/**
 * Error thrown when a binary lacks execute permissions
 */
export class BinaryPermissionError extends Data.TaggedError("BinaryPermissionError")<{
  readonly path: string;
}> {}

/**
 * Error thrown when the user aborts an interactive prompt
 */
export class UserAbortError extends Data.TaggedError("UserAbortError")<{
  readonly cause: unknown;
  readonly context: string;
}> {}

/**
 * Error thrown when a pre-test script fails to execute
 */
export class ScriptExecutionError extends Data.TaggedError("ScriptExecutionError")<{
  readonly cause: unknown;
  readonly script: string;
  readonly scriptsDir: string;
}> {}
