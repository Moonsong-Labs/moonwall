import { Context, type Effect } from "effect";
import type { DevLaunchSpec } from "@moonwall/types";
import type { ChildProcess } from "node:child_process";
import type {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
} from "../errors/foundation.js";

/**
 * Configuration for the DevFoundationService.
 *
 * This is the input configuration used to start a dev foundation,
 * derived from the environment configuration's DevLaunchSpec.
 */
export interface DevFoundationConfig {
  /** The command to execute (binary path) */
  readonly command: string;

  /** Command line arguments */
  readonly args: ReadonlyArray<string>;

  /** Human-readable name for the node (used in logs) */
  readonly name: string;

  /** The original launch specification from the config */
  readonly launchSpec: DevLaunchSpec;

  /** Whether this is an Ethereum-compatible chain (affects RPC validation) */
  readonly isEthereumChain: boolean;

  /**
   * Timeout for startup operations in milliseconds.
   * If not specified, defaults to 2 minutes.
   */
  readonly startupTimeoutMs?: number;

  /**
   * Timeout for shutdown operations in milliseconds.
   * If not specified, defaults to 30 seconds.
   */
  readonly shutdownTimeoutMs?: number;
}

/**
 * Status of a running dev foundation node.
 */
export type DevFoundationStatus =
  | { readonly _tag: "Starting" }
  | { readonly _tag: "Running"; readonly rpcPort: number; readonly pid: number }
  | { readonly _tag: "Stopped" }
  | { readonly _tag: "Failed"; readonly error: unknown };

/**
 * Result from successfully starting a dev foundation.
 */
export interface DevFoundationRunningInfo {
  /** The running child process */
  readonly process: ChildProcess;

  /** The discovered RPC port */
  readonly rpcPort: number;

  /** Path to the log file for this node */
  readonly logPath: string;

  /** Original configuration used to start the node */
  readonly config: DevFoundationConfig;
}

/**
 * DevFoundationService provides Effect-based lifecycle management for
 * development blockchain nodes (Substrate nodes, Moonbeam, etc.).
 *
 * This service is a high-level abstraction over the lower-level
 * ProcessManagerService and port discovery services. It handles:
 *
 * - Starting nodes with automatic port discovery
 * - Health checks via RPC endpoints
 * - Graceful shutdown with cleanup
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { DevFoundationService } from "./DevFoundationService.js";
 *
 * const program = Effect.gen(function* () {
 *   const devFoundation = yield* DevFoundationService;
 *
 *   // Start the node
 *   const { info, stop } = yield* devFoundation.start(config);
 *   console.log(`Node running on port ${info.rpcPort}`);
 *
 *   // Check status
 *   const status = yield* devFoundation.getStatus();
 *   if (status._tag === "Running") {
 *     console.log(`PID: ${status.pid}, Port: ${status.rpcPort}`);
 *   }
 *
 *   // Stop when done (manually, or use Effect.acquireRelease)
 *   yield* stop;
 * });
 * ```
 */
export class DevFoundationService extends Context.Tag("DevFoundationService")<
  DevFoundationService,
  {
    /**
     * Start a dev foundation node.
     *
     * This spawns the node process, waits for port discovery,
     * and validates the RPC endpoint is responsive.
     *
     * @param config - Configuration for the node
     * @returns Effect yielding the running node info and a stop effect
     *
     * @example
     * ```ts
     * const { info, stop } = yield* devFoundation.start({
     *   command: "./moonbeam",
     *   args: ["--dev", "--sealing=manual"],
     *   name: "moonbeam",
     *   launchSpec: spec,
     *   isEthereumChain: true,
     * });
     * ```
     */
    readonly start: (config: DevFoundationConfig) => Effect.Effect<
      {
        readonly info: DevFoundationRunningInfo;
        readonly stop: Effect.Effect<void, FoundationShutdownError>;
      },
      FoundationStartupError
    >;

    /**
     * Stop the running dev foundation node.
     *
     * Sends SIGTERM to the process and waits for graceful shutdown.
     * If the node doesn't respond, SIGKILL is sent after a timeout.
     *
     * @returns Effect that completes when the node is fully stopped
     */
    readonly stop: () => Effect.Effect<void, FoundationShutdownError>;

    /**
     * Get the current status of the dev foundation.
     *
     * @returns The current status (Starting, Running, Stopped, or Failed)
     */
    readonly getStatus: () => Effect.Effect<DevFoundationStatus>;

    /**
     * Perform a health check on the running node.
     *
     * Calls the `system_health` RPC method to verify the node is responsive.
     *
     * @returns Effect that succeeds if healthy, fails with FoundationHealthCheckError otherwise
     */
    readonly healthCheck: () => Effect.Effect<void, FoundationHealthCheckError>;
  }
>() {}

export type { DevFoundationService as DevFoundationServiceType };
