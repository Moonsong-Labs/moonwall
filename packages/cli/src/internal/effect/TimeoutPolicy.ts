import { Data, Duration, Effect } from "effect";

/**
 * Centralized timeout policies for Effect operations.
 *
 * This module provides consistent timeout strategies across all Effect services
 * in Moonwall. Using centralized policies ensures:
 * - Consistent timeout behavior across services
 * - Easier tuning of timeout parameters
 * - User-friendly error messages on timeout
 *
 * All timeouts use Effect.timeout which returns Option.none on timeout.
 * For typed errors, use withTimeout() which converts to OperationTimeoutError.
 */

/**
 * Tagged error for timeout operations with user-friendly context.
 *
 * This error provides detailed information about what operation timed out,
 * where it was attempting to connect, and how long the timeout was.
 */
export class OperationTimeoutError extends Data.TaggedError("OperationTimeoutError")<{
  /** The type of operation that timed out */
  readonly operation: TimeoutOperation;
  /** Human-readable description of what was being attempted */
  readonly description: string;
  /** Duration of the timeout in milliseconds */
  readonly timeoutMs: number;
  /** Optional endpoint/URL that was being connected to */
  readonly endpoint?: string;
  /** Optional additional context */
  readonly context?: Record<string, unknown>;
}> {
  /**
   * Get a user-friendly error message for display.
   */
  get userMessage(): string {
    const durationStr = formatDuration(this.timeoutMs);
    const endpointStr = this.endpoint ? ` to ${this.endpoint}` : "";
    return `Operation timed out after ${durationStr}: ${this.description}${endpointStr}`;
  }
}

/**
 * Types of operations that can timeout.
 * Used for categorization and metrics.
 */
export type TimeoutOperation =
  | "foundation_startup"
  | "foundation_shutdown"
  | "provider_connection"
  | "block_creation"
  | "storage_operation"
  | "health_check"
  | "rpc_call"
  | "websocket_connection"
  | "port_discovery"
  | "node_readiness"
  | "generic";

/**
 * Configuration for timeout operations.
 */
export interface TimeoutConfig {
  /** Timeout duration */
  readonly duration: Duration.DurationInput;
  /** Operation type for error categorization */
  readonly operation: TimeoutOperation;
  /** Human-readable description for error messages */
  readonly description: string;
  /** Optional endpoint being connected to */
  readonly endpoint?: string;
  /** Optional additional context for debugging */
  readonly context?: Record<string, unknown>;
}

/**
 * Default timeout durations for various operations.
 * These can be overridden per-environment in moonwall.config.json.
 */
export const TimeoutDefaults = {
  /** Foundation startup (node spawn + port discovery + readiness) */
  foundationStartup: Duration.minutes(2),
  /** Foundation shutdown (graceful process termination) */
  foundationShutdown: Duration.seconds(30),
  /** Provider connection (includes retry time) */
  providerConnection: Duration.minutes(5),
  /** Chopsticks block creation */
  blockCreation: Duration.seconds(30),
  /** Storage operations (setStorage, getBlock, etc.) */
  storageOperation: Duration.seconds(10),
  /** Health check operations */
  healthCheck: Duration.seconds(30),
  /** Individual RPC call */
  rpcCall: Duration.seconds(10),
  /** WebSocket initial connection */
  websocketConnection: Duration.seconds(30),
  /** Port discovery polling */
  portDiscovery: Duration.minutes(2),
  /** Node readiness check */
  nodeReadiness: Duration.minutes(2),
} as const;

/**
 * Format a duration in milliseconds to a human-readable string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    const seconds = Math.round(ms / 1000);
    return `${seconds}s`;
  }
  const minutes = Math.round(ms / 60000);
  return `${minutes}m`;
}

/**
 * Wrap an Effect with a timeout that produces a typed OperationTimeoutError.
 *
 * This is the recommended way to add timeouts to operations because:
 * 1. It provides a typed error (OperationTimeoutError) instead of Option.none
 * 2. It includes context about what operation timed out
 * 3. It has user-friendly error messages for CLI display
 *
 * @param effect The effect to wrap with a timeout
 * @param config Timeout configuration with duration and context
 * @returns Effect that fails with OperationTimeoutError on timeout
 *
 * @example
 * ```ts
 * const startNode = pipe(
 *   processManager.launch(config),
 *   withTimeout({
 *     duration: "2 minutes",
 *     operation: "foundation_startup",
 *     description: "Starting dev foundation",
 *     endpoint: "localhost:9944",
 *   })
 * );
 * ```
 */
export const withTimeout = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  config: TimeoutConfig
): Effect.Effect<A, E | OperationTimeoutError, R> => {
  const timeoutMs = Duration.toMillis(config.duration);

  return effect.pipe(
    Effect.timeoutFail({
      duration: config.duration,
      onTimeout: () =>
        new OperationTimeoutError({
          operation: config.operation,
          description: config.description,
          timeoutMs,
          endpoint: config.endpoint,
          context: config.context,
        }),
    })
  );
};

/**
 * Create a timeout configuration for foundation startup operations.
 *
 * @param name Foundation name
 * @param timeout Custom timeout duration (defaults to 2 minutes)
 * @param endpoint Optional endpoint being connected to
 */
export const foundationStartupTimeout = (
  name: string,
  timeout: Duration.DurationInput = TimeoutDefaults.foundationStartup,
  endpoint?: string
): TimeoutConfig => ({
  duration: timeout,
  operation: "foundation_startup",
  description: `Starting foundation "${name}"`,
  endpoint,
});

/**
 * Create a timeout configuration for foundation shutdown operations.
 *
 * @param name Foundation name
 * @param timeout Custom timeout duration (defaults to 30 seconds)
 */
export const foundationShutdownTimeout = (
  name: string,
  timeout: Duration.DurationInput = TimeoutDefaults.foundationShutdown
): TimeoutConfig => ({
  duration: timeout,
  operation: "foundation_shutdown",
  description: `Stopping foundation "${name}"`,
});

/**
 * Create a timeout configuration for provider connection operations.
 *
 * @param providerName Provider name
 * @param providerType Provider type (polkadotJs, ethers, etc.)
 * @param endpoint Endpoint being connected to
 * @param timeout Custom timeout duration (defaults to 5 minutes)
 */
export const providerConnectionTimeout = (
  providerName: string,
  providerType: string,
  endpoint: string,
  timeout: Duration.DurationInput = TimeoutDefaults.providerConnection
): TimeoutConfig => ({
  duration: timeout,
  operation: "provider_connection",
  description: `Connecting ${providerType} provider "${providerName}"`,
  endpoint,
  context: { providerType },
});

/**
 * Create a timeout configuration for chopsticks block creation.
 *
 * @param blockCount Number of blocks to create
 * @param timeout Custom timeout duration (defaults to 30 seconds)
 */
export const blockCreationTimeout = (
  blockCount = 1,
  timeout: Duration.DurationInput = TimeoutDefaults.blockCreation
): TimeoutConfig => ({
  duration: timeout,
  operation: "block_creation",
  description: `Creating ${blockCount} block${blockCount > 1 ? "s" : ""}`,
  context: { blockCount },
});

/**
 * Create a timeout configuration for storage operations.
 *
 * @param operationType Type of storage operation (setStorage, getBlock, etc.)
 * @param timeout Custom timeout duration (defaults to 10 seconds)
 */
export const storageOperationTimeout = (
  operationType: string,
  timeout: Duration.DurationInput = TimeoutDefaults.storageOperation
): TimeoutConfig => ({
  duration: timeout,
  operation: "storage_operation",
  description: `Executing storage operation: ${operationType}`,
  context: { operationType },
});

/**
 * Create a timeout configuration for health check operations.
 *
 * @param targetName Name of the service being checked
 * @param endpoint Endpoint being checked
 * @param timeout Custom timeout duration (defaults to 30 seconds)
 */
export const healthCheckTimeout = (
  targetName: string,
  endpoint?: string,
  timeout: Duration.DurationInput = TimeoutDefaults.healthCheck
): TimeoutConfig => ({
  duration: timeout,
  operation: "health_check",
  description: `Health checking "${targetName}"`,
  endpoint,
});

/**
 * Create a timeout configuration for RPC calls.
 *
 * @param method RPC method being called
 * @param endpoint RPC endpoint
 * @param timeout Custom timeout duration (defaults to 10 seconds)
 */
export const rpcCallTimeout = (
  method: string,
  endpoint?: string,
  timeout: Duration.DurationInput = TimeoutDefaults.rpcCall
): TimeoutConfig => ({
  duration: timeout,
  operation: "rpc_call",
  description: `RPC call: ${method}`,
  endpoint,
  context: { method },
});

/**
 * Create a timeout configuration for WebSocket connections.
 *
 * @param endpoint WebSocket endpoint
 * @param timeout Custom timeout duration (defaults to 30 seconds)
 */
export const websocketConnectionTimeout = (
  endpoint: string,
  timeout: Duration.DurationInput = TimeoutDefaults.websocketConnection
): TimeoutConfig => ({
  duration: timeout,
  operation: "websocket_connection",
  description: "Establishing WebSocket connection",
  endpoint,
});

/**
 * Create a timeout configuration for port discovery.
 *
 * @param pid Process ID being monitored
 * @param timeout Custom timeout duration (defaults to 2 minutes)
 */
export const portDiscoveryTimeout = (
  pid: number,
  timeout: Duration.DurationInput = TimeoutDefaults.portDiscovery
): TimeoutConfig => ({
  duration: timeout,
  operation: "port_discovery",
  description: `Discovering RPC port for PID ${pid}`,
  context: { pid },
});

/**
 * Create a timeout configuration for node readiness checks.
 *
 * @param port Port to check
 * @param timeout Custom timeout duration (defaults to 2 minutes)
 */
export const nodeReadinessTimeout = (
  port: number,
  timeout: Duration.DurationInput = TimeoutDefaults.nodeReadiness
): TimeoutConfig => ({
  duration: timeout,
  operation: "node_readiness",
  description: `Waiting for node to be ready on port ${port}`,
  endpoint: `ws://localhost:${port}`,
  context: { port },
});

/**
 * Create a custom timeout configuration.
 *
 * @param duration Timeout duration
 * @param description Human-readable description
 * @param options Additional options
 */
export const customTimeout = (
  duration: Duration.DurationInput,
  description: string,
  options?: {
    operation?: TimeoutOperation;
    endpoint?: string;
    context?: Record<string, unknown>;
  }
): TimeoutConfig => ({
  duration,
  operation: options?.operation ?? "generic",
  description,
  endpoint: options?.endpoint,
  context: options?.context,
});

/**
 * Check if an error is an OperationTimeoutError.
 */
export const isOperationTimeoutError = (error: unknown): error is OperationTimeoutError =>
  error instanceof OperationTimeoutError ||
  (typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "OperationTimeoutError");

/**
 * Format an OperationTimeoutError for user display.
 * Provides actionable suggestions based on the operation type.
 */
export const formatTimeoutError = (error: OperationTimeoutError): string => {
  const lines = [error.userMessage];

  // Add suggestions based on operation type
  switch (error.operation) {
    case "foundation_startup":
      lines.push("");
      lines.push("Suggestions:");
      lines.push("  - Check that the node binary is available and executable");
      lines.push("  - Verify the node configuration is correct");
      lines.push("  - Increase the startup timeout in moonwall.config.json");
      break;
    case "provider_connection":
      lines.push("");
      lines.push("Suggestions:");
      lines.push("  - Check that the endpoint is reachable");
      lines.push("  - Verify the RPC server is running");
      lines.push("  - Check for network/firewall issues");
      break;
    case "block_creation":
      lines.push("");
      lines.push("Suggestions:");
      lines.push("  - Verify the chopsticks instance is responding");
      lines.push("  - Check for pending transactions that might be blocking");
      break;
    case "health_check":
      lines.push("");
      lines.push("Suggestions:");
      lines.push("  - Verify the service is still running");
      lines.push("  - Check network connectivity");
      break;
    default:
      // No additional suggestions for other operation types
      break;
  }

  return lines.join("\n");
};
