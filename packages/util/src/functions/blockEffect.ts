/**
 * Effect-based block helper functions
 *
 * This module provides Effect versions of block operations from block.ts.
 * Each function returns an Effect that can be composed with other Effects.
 *
 * For backwards compatibility, use the original functions from block.ts
 * which remain Promise-based.
 */
import type { ApiPromise } from "@polkadot/api";
import type { BlockHash, Event, Extrinsic } from "@polkadot/types/interfaces";
import type { SignedBlock } from "@polkadot/types/interfaces/runtime/types";
import type { u32 } from "@polkadot/types";
import Bottleneck from "bottleneck";
import { Data, Effect } from "effect";
import { getBlockTime } from "./block";
import { createLogger } from "./logger";

/* eslint-disable @typescript-eslint/no-explicit-any */

const logger = createLogger({ name: "test:blocks:effect" });
const debug = logger.debug.bind(logger);

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error when block creation fails
 */
export class BlockCreationError extends Data.TaggedError("BlockCreationError")<{
  readonly message: string;
  readonly parentHash?: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when block lookup fails
 */
export class BlockLookupError extends Data.TaggedError("BlockLookupError")<{
  readonly message: string;
  readonly blockHash: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when extrinsic lookup fails
 */
export class ExtrinsicLookupError extends Data.TaggedError("ExtrinsicLookupError")<{
  readonly message: string;
  readonly blockHash: string;
  readonly section: string;
  readonly method: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when block finalization check fails
 */
export class BlockFinalizationError extends Data.TaggedError("BlockFinalizationError")<{
  readonly message: string;
  readonly blockNumber: number;
  readonly cause?: unknown;
}> {}

/**
 * Error when historic block search fails
 */
export class HistoricBlockError extends Data.TaggedError("HistoricBlockError")<{
  readonly message: string;
  readonly targetTime: number;
  readonly cause?: unknown;
}> {}

/**
 * Error when runtime upgrade check fails
 */
export class RuntimeUpgradeCheckError extends Data.TaggedError("RuntimeUpgradeCheckError")<{
  readonly message: string;
  readonly blockNumber: number;
  readonly cause?: unknown;
}> {}

// ============================================================================
// Effect-based Block Operations
// ============================================================================

export interface CreateBlockResult {
  duration: number;
  hash: string;
  proofSize?: number;
}

/**
 * Creates and optionally finalizes a block.
 *
 * @param api - Connected ApiPromise instance
 * @param parentHash - Optional parent hash for the block
 * @param finalize - Whether to finalize the block (default: false)
 * @returns Effect containing the block creation result
 *
 * @example
 * ```ts
 * const result = await Effect.runPromise(
 *   createAndFinalizeBlockEffect(api, undefined, true)
 * );
 * console.log(`Created block: ${result.hash} in ${result.duration}ms`);
 * ```
 */
export const createAndFinalizeBlockEffect = (
  api: ApiPromise,
  parentHash?: string,
  finalize = false
): Effect.Effect<CreateBlockResult, BlockCreationError> =>
  Effect.tryPromise({
    try: async () => {
      const startTime = Date.now();
      // TODO: any/raw rpc request can be removed once api-augment is updated
      const block: any = parentHash
        ? await api.rpc("engine_createBlock", true, finalize, parentHash)
        : await api.rpc("engine_createBlock", true, finalize);

      return {
        duration: Date.now() - startTime,
        hash: block.hash as string,
        proofSize: block.proof_size as number | undefined,
      };
    },
    catch: (error) =>
      new BlockCreationError({
        message: `Failed to create block${parentHash ? ` with parent ${parentHash}` : ""}`,
        parentHash,
        cause: error,
      }),
  });

export interface BlockExtrinsicResult {
  block: SignedBlock | any;
  extrinsic: Extrinsic | null | any;
  events: Event[];
  resultEvent: Event | undefined;
}

/**
 * Gets a specific extrinsic from a block by section and method.
 *
 * @param api - Connected ApiPromise instance
 * @param blockHash - Hash of the block to search
 * @param section - Pallet section name (e.g., "timestamp")
 * @param method - Method name (e.g., "set")
 * @returns Effect containing the extrinsic and related events
 *
 * @example
 * ```ts
 * const result = await Effect.runPromise(
 *   getBlockExtrinsicEffect(api, blockHash, "balances", "transfer")
 * );
 * if (result.extrinsic) {
 *   console.log("Found transfer extrinsic");
 * }
 * ```
 */
export const getBlockExtrinsicEffect = (
  api: ApiPromise,
  blockHash: string | BlockHash,
  section: string,
  method: string
): Effect.Effect<BlockExtrinsicResult, ExtrinsicLookupError> =>
  Effect.tryPromise({
    try: async () => {
      const apiAt = await api.at(blockHash);
      const [{ block }, records] = await Promise.all([
        api.rpc.chain.getBlock(blockHash),
        apiAt.query.system.events(),
      ]);
      const extIndex = block.extrinsics.findIndex(
        (ext) => ext.method.section === section && ext.method.method === method
      );
      const extrinsic = extIndex > -1 ? block.extrinsics[extIndex] : null;

      const events = (records as any)
        .filter(({ phase }: any) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extIndex))
        .map(({ event }: any) => event);
      const resultEvent = events.find(
        (event: any) =>
          event.section === "system" &&
          (event.method === "ExtrinsicSuccess" || event.method === "ExtrinsicFailed")
      );
      return { block, extrinsic, events, resultEvent };
    },
    catch: (error) =>
      new ExtrinsicLookupError({
        message: `Failed to get extrinsic ${section}.${method} from block`,
        blockHash: typeof blockHash === "string" ? blockHash : blockHash.toString(),
        section,
        method,
        cause: error,
      }),
  });

export interface BlockFinalizedResult {
  number: number;
  finalized: boolean;
}

/**
 * Checks if a block is finalized.
 *
 * @param api - Connected ApiPromise instance
 * @param number - Block number to check
 * @returns Effect containing the finalization status
 *
 * @example
 * ```ts
 * const result = await Effect.runPromise(
 *   checkBlockFinalizedEffect(api, 1000)
 * );
 * console.log(`Block ${result.number} finalized: ${result.finalized}`);
 * ```
 */
export const checkBlockFinalizedEffect = (
  api: ApiPromise,
  number: number
): Effect.Effect<BlockFinalizedResult, BlockFinalizationError> =>
  Effect.tryPromise({
    try: async () => {
      const blockHash = await api.rpc.chain.getBlockHash(number);
      // @ts-expect-error - remove once pJs exposes this
      const finalized = await api._rpcCore.provider.send("moon_isBlockFinalized", [blockHash]);
      return { number, finalized };
    },
    catch: (error) =>
      new BlockFinalizationError({
        message: `Failed to check if block ${number} is finalized`,
        blockNumber: number,
        cause: error,
      }),
  });

/**
 * Fetches the timestamp of a block.
 *
 * @internal
 */
const fetchBlockTimeEffect = (
  api: ApiPromise,
  blockNum: number
): Effect.Effect<number, BlockLookupError> =>
  Effect.tryPromise({
    try: async () => {
      const hash = await api.rpc.chain.getBlockHash(blockNum);
      const block = await api.rpc.chain.getBlock(hash);
      return getBlockTime(block);
    },
    catch: (error) =>
      new BlockLookupError({
        message: `Failed to fetch block time for block ${blockNum}`,
        blockHash: `block #${blockNum}`,
        cause: error,
      }),
  });

/**
 * Binary search to find the block number closest to a target timestamp.
 * Used for finding historic blocks within a time range.
 *
 * @param api - Connected ApiPromise instance
 * @param blockNumber - Starting block number for search
 * @param targetTime - Target timestamp in milliseconds
 * @returns Effect containing the closest block number
 *
 * @example
 * ```ts
 * // Find the block from 1 hour ago
 * const blockNum = await Effect.runPromise(
 *   fetchHistoricBlockNumEffect(api, latestBlock, Date.now() - 3600000)
 * );
 * ```
 */
export const fetchHistoricBlockNumEffect = (
  api: ApiPromise,
  blockNumber: number,
  targetTime: number
): Effect.Effect<number, HistoricBlockError> => {
  const search = (currentBlock: number): Effect.Effect<number, HistoricBlockError> => {
    if (currentBlock <= 1) {
      return Effect.succeed(1);
    }

    return Effect.flatMap(
      Effect.mapError(
        fetchBlockTimeEffect(api, currentBlock),
        (err) =>
          new HistoricBlockError({
            message: `Failed to search for historic block at time ${new Date(targetTime).toISOString()}`,
            targetTime,
            cause: err,
          })
      ),
      (time) => {
        if (time <= targetTime) {
          return Effect.succeed(currentBlock);
        }
        const nextBlock = currentBlock - Math.ceil((time - targetTime) / 30_000);
        return search(nextBlock);
      }
    );
  };

  return search(blockNumber);
};

/**
 * Gets an array of block numbers from a given time period.
 * Returns sequential block numbers from firstBlock to lastBlock.
 *
 * @param api - Connected ApiPromise instance
 * @param timePeriod - Time period in milliseconds to look back
 * @param bottleneck - Optional rate limiter
 * @returns Effect containing array of block numbers
 *
 * @example
 * ```ts
 * // Get blocks from the last hour
 * const blocks = await Effect.runPromise(
 *   getBlockArrayEffect(api, 3600000)
 * );
 * console.log(`Found ${blocks.length} blocks`);
 * ```
 */
export const getBlockArrayEffect = (
  api: ApiPromise,
  timePeriod: number,
  bottleneck?: Bottleneck
): Effect.Effect<number[], HistoricBlockError> =>
  Effect.tryPromise({
    try: async () => {
      let limiter = bottleneck;
      if (!limiter) {
        limiter = new Bottleneck({ maxConcurrent: 10, minTime: 100 });
      }

      const finalizedHead = await limiter.schedule(() => api.rpc.chain.getFinalizedHead());
      const signedBlock = await limiter.schedule(() => api.rpc.chain.getBlock(finalizedHead));

      const lastBlockNumber = signedBlock.block.header.number.toNumber();
      const lastBlockTime = getBlockTime(signedBlock);
      const firstBlockTime = lastBlockTime - timePeriod;

      debug(`Searching for the block at: ${new Date(firstBlockTime)}`);

      // Use the Promise-based recursive search wrapped in the limiter
      const fetchHistoricBlockNum = async (
        blockNumber: number,
        targetTime: number
      ): Promise<number> => {
        if (blockNumber <= 1) return 1;
        const hash = await api.rpc.chain.getBlockHash(blockNumber);
        const block = await api.rpc.chain.getBlock(hash);
        const time = getBlockTime(block);
        if (time <= targetTime) return blockNumber;
        return fetchHistoricBlockNum(
          blockNumber - Math.ceil((time - targetTime) / 30_000),
          targetTime
        );
      };

      const firstBlockNumber = (await limiter.wrap(fetchHistoricBlockNum)(
        lastBlockNumber,
        firstBlockTime
      )) as number;
      const length = lastBlockNumber - firstBlockNumber;
      return Array.from({ length }, (_, i) => firstBlockNumber + i);
    },
    catch: (error) =>
      new HistoricBlockError({
        message: `Failed to get block array for time period ${timePeriod}ms`,
        targetTime: Date.now() - timePeriod,
        cause: error,
      }),
  });

export interface RuntimeUpgradeResult {
  result: boolean;
  specVersion: u32;
}

/**
 * Checks if runtime upgrades occurred in a time slice of blocks.
 *
 * @param api - Connected ApiPromise instance
 * @param blockNumbers - Array of block numbers to check
 * @param currentVersion - Current runtime version to compare against
 * @returns Effect containing the upgrade check result
 *
 * @example
 * ```ts
 * const result = await Effect.runPromise(
 *   checkTimeSliceForUpgradesEffect(api, [1000, 1001, 1002], currentSpecVersion)
 * );
 * if (result.result) {
 *   console.log(`Upgrade detected! New version: ${result.specVersion}`);
 * }
 * ```
 */
export const checkTimeSliceForUpgradesEffect = (
  api: ApiPromise,
  blockNumbers: number[],
  currentVersion: u32
): Effect.Effect<RuntimeUpgradeResult, RuntimeUpgradeCheckError> =>
  Effect.tryPromise({
    try: async () => {
      if (blockNumbers.length === 0) {
        throw new Error("Block numbers array is empty");
      }
      const blockHash = await api.rpc.chain.getBlockHash(blockNumbers[0]);
      const apiAt = await api.at(blockHash);
      const lastUpgrade = (await apiAt.query.system.lastRuntimeUpgrade()) as any;
      const onChainRt = lastUpgrade.unwrap().specVersion;
      return { result: !onChainRt.eq(currentVersion), specVersion: onChainRt };
    },
    catch: (error) =>
      new RuntimeUpgradeCheckError({
        message: `Failed to check for runtime upgrades at block ${blockNumbers[0]}`,
        blockNumber: blockNumbers[0] ?? 0,
        cause: error,
      }),
  });
