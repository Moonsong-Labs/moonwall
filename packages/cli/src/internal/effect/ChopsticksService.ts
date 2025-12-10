/**
 * Effect-based Chopsticks Service for programmatic blockchain fork management
 *
 * This service provides a type-safe, Effect-based interface to @acala-network/chopsticks,
 * replacing the previous CLI-subprocess approach with direct programmatic control.
 */

import { Context, Data, Effect } from "effect";
import type { Blockchain, BuildBlockMode } from "@acala-network/chopsticks";
import type { HexString } from "@polkadot/util/types";

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error thrown when chopsticks setup/initialization fails
 */
export class ChopsticksSetupError extends Data.TaggedError("ChopsticksSetupError")<{
  readonly cause: unknown;
  readonly endpoint?: string;
  readonly block?: string | number;
}> {}

/**
 * Error thrown when block creation fails
 */
export class ChopsticksBlockError extends Data.TaggedError("ChopsticksBlockError")<{
  readonly cause: unknown;
  readonly operation: "newBlock" | "setHead" | "getBlock";
  readonly blockIdentifier?: string | number;
}> {}

/**
 * Error thrown when storage operations fail
 */
export class ChopsticksStorageError extends Data.TaggedError("ChopsticksStorageError")<{
  readonly cause: unknown;
  readonly module: string;
  readonly method: string;
}> {}

/**
 * Error thrown when extrinsic operations fail
 */
export class ChopsticksExtrinsicError extends Data.TaggedError("ChopsticksExtrinsicError")<{
  readonly cause: unknown;
  readonly operation: "submit" | "dryRun" | "validate";
  readonly extrinsic?: string;
}> {}

/**
 * Error thrown when XCM message operations fail
 */
export class ChopsticksXcmError extends Data.TaggedError("ChopsticksXcmError")<{
  readonly cause: unknown;
  readonly messageType: "ump" | "dmp" | "hrmp";
  readonly paraId?: number;
}> {}

/**
 * Error thrown when chopsticks cleanup/shutdown fails
 */
export class ChopsticksCleanupError extends Data.TaggedError("ChopsticksCleanupError")<{
  readonly cause: unknown;
}> {}

/**
 * Union type of all chopsticks errors for exhaustive handling
 */
export type ChopsticksError =
  | ChopsticksSetupError
  | ChopsticksBlockError
  | ChopsticksStorageError
  | ChopsticksExtrinsicError
  | ChopsticksXcmError
  | ChopsticksCleanupError;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for launching a chopsticks instance
 */
export interface ChopsticksConfig {
  /** WebSocket endpoint to fork from (e.g., "wss://rpc.polkadot.io") */
  readonly endpoint: string;
  /** Block number or hash to fork from (defaults to latest finalized) */
  readonly block?: string | number | null;
  /** Port to listen on (defaults to 8000) */
  readonly port?: number;
  /** Host to bind to (defaults to "127.0.0.1") */
  readonly host?: string;
  /** Block building mode: "batch" | "manual" | "instant" */
  readonly buildBlockMode?: BuildBlockMode;
  /** Path to WASM override file */
  readonly wasmOverride?: string;
  /** Whether to allow unresolved imports in WASM */
  readonly allowUnresolvedImports?: boolean;
  /** Whether to mock signature verification */
  readonly mockSignatureHost?: boolean;
  /** Path to SQLite database for caching */
  readonly db?: string;
  /** Storage overrides to apply */
  readonly importStorage?: Record<string, Record<string, unknown>>;
  /** Runtime log level (0-5) */
  readonly runtimeLogLevel?: number;
}

/**
 * Result from creating a new block
 */
export interface BlockCreationResult {
  /** The created block */
  readonly block: {
    readonly hash: HexString;
    readonly number: number;
  };
}

/**
 * Parameters for creating a new block
 */
export interface BlockCreationParams {
  /** Number of blocks to create */
  readonly count?: number;
  /** Target block number to create up to */
  readonly to?: number;
  /** Transactions to include */
  readonly transactions?: HexString[];
  /** UMP messages to include */
  readonly ump?: Record<number, HexString[]>;
  /** DMP messages to include */
  readonly dmp?: Array<{ sentAt: number; msg: HexString }>;
  /** HRMP messages to include */
  readonly hrmp?: Record<number, Array<{ sentAt: number; data: HexString }>>;
}

/**
 * Result from dry-running an extrinsic
 */
export interface DryRunResult {
  /** Whether the extrinsic would succeed */
  readonly success: boolean;
  /** Storage changes that would occur */
  readonly storageDiff: Array<[HexString, HexString | null]>;
  /** Any error message if failed */
  readonly error?: string;
}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * ChopsticksService provides programmatic access to a chopsticks blockchain fork.
 *
 * This service wraps the @acala-network/chopsticks library and exposes its
 * functionality through Effect-based methods with proper error handling.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const chopsticks = yield* ChopsticksService;
 *
 *   // Create a new block
 *   const block = yield* chopsticks.createBlock();
 *   console.log(`Created block #${block.block.number}`);
 *
 *   // Modify storage
 *   yield* chopsticks.setStorage({
 *     module: "System",
 *     method: "Account",
 *     params: [[address, { data: { free: "1000000000000" } }]]
 *   });
 * });
 * ```
 */
export class ChopsticksService extends Context.Tag("ChopsticksService")<
  ChopsticksService,
  {
    /**
     * Direct access to the underlying Blockchain instance.
     * Use this for advanced operations not covered by the service methods.
     */
    readonly chain: Blockchain;

    /**
     * The WebSocket address the chopsticks server is listening on
     */
    readonly addr: string;

    /**
     * The port the chopsticks server is listening on
     */
    readonly port: number;

    /**
     * Create one or more new blocks
     *
     * @param params - Optional block creation parameters
     * @returns The created block information
     */
    readonly createBlock: (
      params?: BlockCreationParams
    ) => Effect.Effect<BlockCreationResult, ChopsticksBlockError>;

    /**
     * Set storage values directly
     *
     * @param params - Storage modification parameters
     */
    readonly setStorage: (params: {
      module: string;
      method: string;
      params: unknown[];
    }) => Effect.Effect<void, ChopsticksStorageError>;

    /**
     * Submit an extrinsic to the transaction pool
     *
     * @param extrinsic - The encoded extrinsic
     * @returns The extrinsic hash
     */
    readonly submitExtrinsic: (
      extrinsic: HexString
    ) => Effect.Effect<HexString, ChopsticksExtrinsicError>;

    /**
     * Dry-run an extrinsic without submitting it
     *
     * @param extrinsic - The encoded extrinsic or call data with address
     * @param at - Optional block hash to dry-run at
     * @returns The dry-run result
     */
    readonly dryRunExtrinsic: (
      extrinsic: HexString | { call: HexString; address: string },
      at?: HexString
    ) => Effect.Effect<DryRunResult, ChopsticksExtrinsicError>;

    /**
     * Get a block by hash or number
     *
     * @param hashOrNumber - Block hash or number (defaults to head)
     */
    readonly getBlock: (
      hashOrNumber?: HexString | number
    ) => Effect.Effect<{ hash: HexString; number: number } | undefined, ChopsticksBlockError>;

    /**
     * Set the head of the chain to a specific block
     *
     * @param hashOrNumber - Block hash or number to set as head
     */
    readonly setHead: (
      hashOrNumber: HexString | number
    ) => Effect.Effect<void, ChopsticksBlockError>;

    /**
     * Submit upward messages (parachain → relay chain)
     *
     * @param paraId - The parachain ID
     * @param messages - Array of encoded UMP messages
     */
    readonly submitUpwardMessages: (
      paraId: number,
      messages: HexString[]
    ) => Effect.Effect<void, ChopsticksXcmError>;

    /**
     * Submit downward messages (relay chain → parachain)
     *
     * @param messages - Array of DMP messages
     */
    readonly submitDownwardMessages: (
      messages: Array<{ sentAt: number; msg: HexString }>
    ) => Effect.Effect<void, ChopsticksXcmError>;

    /**
     * Submit horizontal messages (parachain → parachain)
     *
     * @param paraId - The source parachain ID
     * @param messages - Array of HRMP messages
     */
    readonly submitHorizontalMessages: (
      paraId: number,
      messages: Array<{ sentAt: number; data: HexString }>
    ) => Effect.Effect<void, ChopsticksXcmError>;
  }
>() {}

/**
 * Configuration service tag for dependency injection
 */
export class ChopsticksConfigTag extends Context.Tag("ChopsticksConfig")<
  ChopsticksConfigTag,
  ChopsticksConfig
>() {}
