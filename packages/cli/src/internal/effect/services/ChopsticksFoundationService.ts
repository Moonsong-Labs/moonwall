import { Context, Effect } from "effect";
import type { ChopsticksLaunchSpec } from "@moonwall/types";
import type { HexString } from "@polkadot/util/types";
import type {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
} from "../errors/foundation.js";
import type {
  BlockCreationParams,
  BlockCreationResult,
  ChopsticksBlockError,
  ChopsticksStorageError,
} from "../ChopsticksService.js";

/**
 * Configuration for the ChopsticksFoundationService.
 *
 * This is the input configuration used to start a chopsticks foundation,
 * derived from the environment configuration's ChopsticksLaunchSpec.
 */
export interface ChopsticksFoundationConfig {
  /** Path to the chopsticks configuration file */
  readonly configPath: string;

  /** Human-readable name for this chopsticks instance (used in logs) */
  readonly name: string;

  /** The original launch specification from the config */
  readonly launchSpec: ChopsticksLaunchSpec;

  /** Optional WebSocket port (only for single-chain mode) */
  readonly wsPort?: number;

  /** Type of chain: relaychain or parachain */
  readonly type?: "relaychain" | "parachain";

  /** Optional WebAssembly override file path */
  readonly wasmOverride?: string;

  /** Block building mode: batch, manual, or instant */
  readonly buildBlockMode?: "batch" | "manual" | "instant";

  /** Timeout for new block operations (ms) */
  readonly newBlockTimeout?: number;
}

/**
 * Status of a running chopsticks foundation instance.
 */
export type ChopsticksFoundationStatus =
  | { readonly _tag: "Starting" }
  | { readonly _tag: "Running"; readonly wsPort: number; readonly endpoint: string }
  | { readonly _tag: "Stopped" }
  | { readonly _tag: "Failed"; readonly error: unknown };

/**
 * Result from successfully starting a chopsticks foundation.
 */
export interface ChopsticksFoundationRunningInfo {
  /** The WebSocket port the chopsticks server is listening on */
  readonly wsPort: number;

  /** The full WebSocket endpoint URL (e.g., "ws://127.0.0.1:8000") */
  readonly endpoint: string;

  /** Path to the log file for this instance */
  readonly logPath?: string;

  /** Original configuration used to start the instance */
  readonly config: ChopsticksFoundationConfig;
}

/**
 * ChopsticksFoundationService provides Effect-based lifecycle management for
 * chopsticks blockchain forks (forked Substrate networks).
 *
 * This service is a high-level abstraction over the lower-level ChopsticksService.
 * It handles:
 *
 * - Starting chopsticks with configuration from YAML/JSON files
 * - Block creation and storage manipulation
 * - Health checks via RPC endpoints
 * - Graceful shutdown with cleanup
 *
 * Chopsticks allows testing against a snapshot of a live network, which is useful
 * for testing runtime upgrades, XCM, and complex state transitions.
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { ChopsticksFoundationService } from "./ChopsticksFoundationService.js";
 *
 * const program = Effect.gen(function* () {
 *   const chopsticks = yield* ChopsticksFoundationService;
 *
 *   // Start the fork
 *   const { info, stop } = yield* chopsticks.start(config);
 *   console.log(`Chopsticks fork running on ${info.endpoint}`);
 *
 *   // Create a new block
 *   const blockResult = yield* chopsticks.createBlock();
 *   console.log(`Created block #${blockResult.block.number}`);
 *
 *   // Modify storage
 *   yield* chopsticks.setStorage({
 *     module: "System",
 *     method: "Account",
 *     params: [[address, { data: { free: "1000000000000" } }]]
 *   });
 *
 *   // Stop when done
 *   yield* stop;
 * });
 * ```
 */
export class ChopsticksFoundationService extends Context.Tag("ChopsticksFoundationService")<
  ChopsticksFoundationService,
  {
    /**
     * Start a chopsticks foundation instance.
     *
     * This loads the configuration, initializes the blockchain fork,
     * starts the WebSocket RPC server, and waits for it to be ready.
     *
     * @param config - Configuration for the chopsticks instance
     * @returns Effect yielding the running instance info and a stop effect
     *
     * @example
     * ```ts
     * const { info, stop } = yield* chopsticks.start({
     *   configPath: "./moonbeam.yml",
     *   name: "moonbeam-fork",
     *   launchSpec: spec,
     *   buildBlockMode: "manual",
     * });
     * ```
     */
    readonly start: (config: ChopsticksFoundationConfig) => Effect.Effect<
      {
        readonly info: ChopsticksFoundationRunningInfo;
        readonly stop: Effect.Effect<void, FoundationShutdownError>;
      },
      FoundationStartupError
    >;

    /**
     * Stop the running chopsticks foundation instance.
     *
     * This closes the WebSocket server, cleans up the blockchain state,
     * and releases all resources.
     *
     * @returns Effect that completes when the instance is fully stopped
     */
    readonly stop: () => Effect.Effect<void, FoundationShutdownError>;

    /**
     * Get the current status of the chopsticks foundation.
     *
     * @returns The current status (Starting, Running, Stopped, or Failed)
     */
    readonly getStatus: () => Effect.Effect<ChopsticksFoundationStatus>;

    /**
     * Perform a health check on the running chopsticks instance.
     *
     * Calls the `system_health` RPC method to verify the instance is responsive.
     *
     * @returns Effect that succeeds if healthy, fails with FoundationHealthCheckError otherwise
     */
    readonly healthCheck: () => Effect.Effect<void, FoundationHealthCheckError>;

    /**
     * Create one or more new blocks.
     *
     * Chopsticks can create blocks manually, allowing precise control over
     * block production for testing purposes.
     *
     * @param params - Optional block creation parameters (count, transactions, XCM messages)
     * @returns The created block information
     *
     * @example
     * ```ts
     * // Create a single empty block
     * const result = yield* chopsticks.createBlock();
     *
     * // Create multiple blocks
     * const result = yield* chopsticks.createBlock({ count: 5 });
     *
     * // Create a block with specific transactions
     * const result = yield* chopsticks.createBlock({
     *   transactions: [encodedExtrinsic]
     * });
     * ```
     */
    readonly createBlock: (
      params?: BlockCreationParams
    ) => Effect.Effect<BlockCreationResult, ChopsticksBlockError>;

    /**
     * Set storage values directly.
     *
     * This allows modifying chain state without going through extrinsics,
     * useful for setting up specific test conditions.
     *
     * @param params - Storage modification parameters
     *
     * @example
     * ```ts
     * // Set an account balance
     * yield* chopsticks.setStorage({
     *   module: "System",
     *   method: "Account",
     *   params: [[accountAddress, { data: { free: "1000000000000000000" } }]]
     * });
     *
     * // Set a pallet storage item
     * yield* chopsticks.setStorage({
     *   module: "Staking",
     *   method: "MinNominatorBond",
     *   params: ["1000000000000"]
     * });
     * ```
     */
    readonly setStorage: (params: {
      module: string;
      method: string;
      params: unknown[];
    }) => Effect.Effect<void, ChopsticksStorageError>;

    /**
     * Get a block by hash or number.
     *
     * @param hashOrNumber - Block hash or number (defaults to head if omitted)
     * @returns The block info or undefined if not found
     */
    readonly getBlock: (
      hashOrNumber?: HexString | number
    ) => Effect.Effect<{ hash: HexString; number: number } | undefined, ChopsticksBlockError>;

    /**
     * Set the head of the chain to a specific block.
     *
     * This allows "rewinding" the chain to test different scenarios
     * from the same starting state.
     *
     * @param hashOrNumber - Block hash or number to set as head
     */
    readonly setHead: (
      hashOrNumber: HexString | number
    ) => Effect.Effect<void, ChopsticksBlockError>;
  }
>() {}

export type { ChopsticksFoundationService as ChopsticksFoundationServiceType };
