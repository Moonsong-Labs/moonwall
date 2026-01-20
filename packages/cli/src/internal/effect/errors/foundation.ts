import { Data } from "effect";
import type { FoundationType } from "@moonwall/types";

/**
 * Error thrown when a foundation fails to start.
 *
 * This is a high-level error that wraps lower-level errors (NodeLaunchError, ProcessError, etc.)
 * and provides a consistent interface for foundation startup failures across all foundation types.
 *
 * @example
 * ```ts
 * Effect.catchTag("FoundationStartupError", (error) => {
 *   console.error(`${error.foundationType} failed to start: ${error.message}`);
 * })
 * ```
 */
export class FoundationStartupError extends Data.TaggedError("FoundationStartupError")<{
  /** The type of foundation that failed to start */
  readonly foundationType: FoundationType;
  /** Human-readable error message */
  readonly message: string;
  /** The underlying cause of the error (e.g., NodeLaunchError, ProcessError) */
  readonly cause?: unknown;
  /** Optional environment name for context */
  readonly environmentName?: string;
}> {}

/**
 * Error thrown when a foundation fails to shutdown cleanly.
 *
 * This error indicates that resources may not have been fully released,
 * which could lead to port conflicts or orphaned processes.
 *
 * @example
 * ```ts
 * Effect.catchTag("FoundationShutdownError", (error) => {
 *   console.warn(`Warning: ${error.foundationType} did not shut down cleanly`);
 * })
 * ```
 */
export class FoundationShutdownError extends Data.TaggedError("FoundationShutdownError")<{
  /** The type of foundation that failed to shutdown */
  readonly foundationType: FoundationType;
  /** Human-readable error message */
  readonly message: string;
  /** The underlying cause of the error */
  readonly cause?: unknown;
  /** List of resources that failed to clean up (e.g., PIDs, ports) */
  readonly failedResources?: ReadonlyArray<string>;
}> {}

/**
 * Error thrown when a blockchain provider connection fails.
 *
 * This covers all provider types: polkadotJs, ethers, viem, web3, papi.
 * Use the `providerType` field to determine which provider failed.
 *
 * @example
 * ```ts
 * Effect.catchTag("ProviderConnectionError", (error) => {
 *   console.error(`Failed to connect ${error.providerType} to ${error.endpoint}`);
 * })
 * ```
 */
export class ProviderConnectionError extends Data.TaggedError("ProviderConnectionError")<{
  /** The type of provider that failed to connect (e.g., "polkadotJs", "ethers") */
  readonly providerType: string;
  /** The endpoint URL that the provider attempted to connect to */
  readonly endpoint: string;
  /** Human-readable error message */
  readonly message: string;
  /** The underlying cause of the error */
  readonly cause?: unknown;
  /** Number of connection attempts made before giving up */
  readonly attemptsMade?: number;
}> {}

/**
 * Error thrown when a foundation health check fails.
 *
 * This can occur when a foundation appears to have started but is not responding
 * to health checks (e.g., RPC system_health calls).
 */
export class FoundationHealthCheckError extends Data.TaggedError("FoundationHealthCheckError")<{
  /** The type of foundation that failed the health check */
  readonly foundationType: FoundationType;
  /** Human-readable error message */
  readonly message: string;
  /** The endpoint that was checked */
  readonly endpoint?: string;
  /** The underlying cause of the error */
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when foundation configuration is invalid.
 *
 * This is thrown during configuration validation, before attempting to start a foundation.
 */
export class FoundationConfigError extends Data.TaggedError("FoundationConfigError")<{
  /** The type of foundation with invalid configuration */
  readonly foundationType: FoundationType;
  /** Human-readable error message describing the configuration issue */
  readonly message: string;
  /** The specific configuration field that is invalid */
  readonly invalidField?: string;
  /** The invalid value that was provided */
  readonly invalidValue?: unknown;
}> {}
