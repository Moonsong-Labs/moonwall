/**
 * Multi-chain Chopsticks support for XCM testing
 *
 * This module provides Effect-based support for launching multiple chopsticks
 * instances and coordinating XCM message passing between them.
 */

import { Context, Data, Effect, Layer } from "effect";
import type { HexString } from "@polkadot/util/types";
import type { BuildBlockMode } from "@acala-network/chopsticks";
import { createLogger } from "@moonwall/util";
import {
  type ChopsticksConfig,
  type BlockCreationResult,
  ChopsticksSetupError,
  ChopsticksXcmError,
  type ChopsticksBlockError,
} from "./ChopsticksService.js";
import { type ChopsticksServiceImpl, launchChopsticksEffect } from "./launchChopsticksEffect.js";

const logger = createLogger({ name: "ChopsticksMultiChain" });

/**
 * Extract a single endpoint string from the config.
 * The ChopsticksConfig endpoint can be a string, array of strings, or undefined.
 */
const getEndpointString = (endpoint: string | string[] | undefined): string | undefined => {
  if (typeof endpoint === "string") return endpoint;
  if (Array.isArray(endpoint)) return endpoint[0];
  return undefined;
};

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error thrown when multi-chain orchestration fails
 */
export class ChopsticksOrchestrationError extends Data.TaggedError("ChopsticksOrchestrationError")<{
  readonly cause: unknown;
  readonly chains: string[];
  readonly operation: "setup" | "xcm" | "cleanup";
}> {}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for a relay chain
 */
export interface RelayChainConfig extends ChopsticksConfig {
  readonly type: "relay";
}

/**
 * Configuration for a parachain
 */
export interface ParachainConfig extends ChopsticksConfig {
  readonly type: "parachain";
  readonly paraId: number;
}

/**
 * Configuration for multi-chain setup
 */
export interface MultiChainConfig {
  readonly relay: RelayChainConfig;
  readonly parachains: ParachainConfig[];
}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * Chain instance with its identifier
 */
export interface ChainInstance {
  readonly service: ChopsticksServiceImpl;
  readonly type: "relay" | "parachain";
  readonly paraId?: number;
}

/**
 * Multi-chain orchestration service
 */
export interface MultiChainService {
  /** Access the relay chain */
  readonly relay: ChopsticksServiceImpl;

  /** Access a parachain by paraId */
  readonly parachain: (paraId: number) => ChopsticksServiceImpl | undefined;

  /** Get all chains */
  readonly chains: Map<string, ChainInstance>;

  /** Create blocks on all chains */
  readonly createBlocksAll: () => Effect.Effect<
    Map<string, BlockCreationResult>,
    ChopsticksBlockError
  >;

  /**
   * Send UMP from parachain to relay
   * (Upward Message Passing: parachain → relay)
   */
  readonly sendUmp: (
    paraId: number,
    messages: HexString[]
  ) => Effect.Effect<void, ChopsticksXcmError>;

  /**
   * Send DMP from relay to parachain
   * (Downward Message Passing: relay → parachain)
   */
  readonly sendDmp: (
    paraId: number,
    messages: Array<{ sentAt: number; msg: HexString }>
  ) => Effect.Effect<void, ChopsticksXcmError>;

  /**
   * Send HRMP between parachains
   * (Horizontal Relay-routed Message Passing: parachain → parachain)
   */
  readonly sendHrmp: (
    fromParaId: number,
    toParaId: number,
    messages: Array<{ sentAt: number; data: HexString }>
  ) => Effect.Effect<void, ChopsticksXcmError>;

  /**
   * Process XCM messages by creating blocks on all chains
   * This advances all chains to process pending XCM messages
   */
  readonly processXcm: () => Effect.Effect<void, ChopsticksBlockError>;
}

/**
 * Service tag for multi-chain orchestration
 */
export class ChopsticksMultiChainService extends Context.Tag("ChopsticksMultiChainService")<
  ChopsticksMultiChainService,
  MultiChainService
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create the multi-chain service implementation
 */
const createMultiChainService = (
  relay: ChopsticksServiceImpl,
  parachains: Map<number, ChopsticksServiceImpl>
): MultiChainService => {
  const chains = new Map<string, ChainInstance>();

  // Add relay chain
  chains.set("relay", { service: relay, type: "relay" });

  // Add parachains
  for (const [paraId, service] of parachains) {
    chains.set(`para-${paraId}`, { service, type: "parachain", paraId });
  }

  return {
    relay,

    parachain: (paraId: number) => parachains.get(paraId),

    chains,

    createBlocksAll: () =>
      Effect.gen(function* () {
        const results = new Map<string, BlockCreationResult>();

        // Create blocks on all chains in parallel
        const blockEffects = Array.from(chains.entries()).map(([id, chain]) =>
          chain.service.createBlock().pipe(Effect.map((result) => [id, result] as const))
        );

        const blockResults = yield* Effect.all(blockEffects, { concurrency: "unbounded" });

        for (const [id, result] of blockResults) {
          results.set(id, result);
        }

        return results;
      }),

    sendUmp: (paraId: number, messages: HexString[]) =>
      Effect.gen(function* () {
        // UMP: Submit upward messages FROM parachain TO relay
        // The messages are submitted to the relay chain
        yield* relay.submitUpwardMessages(paraId, messages);
        logger.debug(`Sent ${messages.length} UMP messages from para ${paraId} to relay`);
      }),

    sendDmp: (paraId: number, messages: Array<{ sentAt: number; msg: HexString }>) =>
      Effect.gen(function* () {
        const para = parachains.get(paraId);
        if (!para) {
          yield* Effect.fail(
            new ChopsticksXcmError({
              cause: new Error(`Parachain ${paraId} not found`),
              messageType: "dmp",
              paraId,
            })
          );
          return;
        }

        // DMP: Submit downward messages FROM relay TO parachain
        // The messages are submitted to the parachain
        yield* para.submitDownwardMessages(messages);
        logger.debug(`Sent ${messages.length} DMP messages from relay to para ${paraId}`);
      }),

    sendHrmp: (
      fromParaId: number,
      toParaId: number,
      messages: Array<{ sentAt: number; data: HexString }>
    ) =>
      Effect.gen(function* () {
        const toPara = parachains.get(toParaId);
        if (!toPara) {
          yield* Effect.fail(
            new ChopsticksXcmError({
              cause: new Error(`Target parachain ${toParaId} not found`),
              messageType: "hrmp",
              paraId: toParaId,
            })
          );
          return;
        }

        // HRMP: Submit horizontal messages FROM one parachain TO another
        // The messages are submitted to the receiving parachain
        yield* toPara.submitHorizontalMessages(fromParaId, messages);
        logger.debug(
          `Sent ${messages.length} HRMP messages from para ${fromParaId} to para ${toParaId}`
        );
      }),

    processXcm: () =>
      Effect.gen(function* () {
        // Create blocks on all chains to process pending XCM messages
        // First create block on relay, then on parachains
        yield* relay.createBlock();
        for (const para of parachains.values()) {
          yield* para.createBlock();
        }
        logger.debug("Processed XCM messages across all chains");
      }),
  };
};

// =============================================================================
// Launch Functions
// =============================================================================

/**
 * Launch a multi-chain setup with manual cleanup
 *
 * @param config - Multi-chain configuration
 * @returns Promise with multi-chain service and cleanup function
 *
 * @example
 * ```typescript
 * const { service, cleanup } = await launchMultiChainEffect({
 *   relay: {
 *     type: "relay",
 *     endpoint: "wss://rpc.polkadot.io",
 *     port: 8000,
 *   },
 *   parachains: [
 *     {
 *       type: "parachain",
 *       paraId: 2000,
 *       endpoint: "wss://moonbeam.rpc.io",
 *       port: 8001,
 *     },
 *   ],
 * });
 *
 * // Send XCM message
 * await Effect.runPromise(service.sendUmp(2000, ["0x..."]));
 *
 * // Process messages
 * await Effect.runPromise(service.processXcm());
 *
 * // Cleanup
 * await cleanup();
 * ```
 */
export async function launchMultiChainEffect(config: MultiChainConfig): Promise<{
  service: MultiChainService;
  cleanup: () => Promise<void>;
}> {
  const cleanups: Array<() => Promise<void>> = [];

  try {
    // Launch relay chain
    logger.debug(`Launching relay chain on port ${config.relay.port}`);
    const relayResult = await launchChopsticksEffect(config.relay);
    cleanups.push(relayResult.cleanup);

    // Launch parachains
    const parachains = new Map<number, ChopsticksServiceImpl>();
    for (const paraConfig of config.parachains) {
      logger.debug(`Launching parachain ${paraConfig.paraId} on port ${paraConfig.port}`);
      const paraResult = await launchChopsticksEffect(paraConfig);
      cleanups.push(paraResult.cleanup);
      parachains.set(paraConfig.paraId, paraResult.result);
    }

    const service = createMultiChainService(relayResult.result, parachains);

    return {
      service,
      cleanup: async () => {
        logger.debug("Cleaning up multi-chain setup...");
        // Cleanup in reverse order (parachains first, then relay)
        for (const cleanupFn of cleanups.reverse()) {
          await cleanupFn();
        }
        logger.debug("Multi-chain cleanup complete");
      },
    };
  } catch (error) {
    // If any launch fails, cleanup what was started
    for (const cleanupFn of cleanups.reverse()) {
      try {
        await cleanupFn();
      } catch {
        // Ignore cleanup errors during error handling
      }
    }
    throw error;
  }
}

/**
 * Create a Layer for multi-chain setup
 *
 * @param config - Multi-chain configuration
 * @returns Layer providing ChopsticksMultiChainService
 */
export const ChopsticksMultiChainLayer = (
  config: MultiChainConfig
): Layer.Layer<ChopsticksMultiChainService, ChopsticksSetupError | ChopsticksOrchestrationError> =>
  Layer.scoped(
    ChopsticksMultiChainService,
    Effect.gen(function* () {
      const cleanups: Array<Effect.Effect<void, never>> = [];

      // Launch relay chain
      const relayResult = yield* Effect.tryPromise({
        try: () => launchChopsticksEffect(config.relay),
        catch: (cause) =>
          new ChopsticksSetupError({
            cause,
            endpoint: getEndpointString(config.relay.endpoint),
          }),
      });
      cleanups.push(
        Effect.tryPromise({
          try: () => relayResult.cleanup(),
          catch: () => undefined,
        }).pipe(Effect.ignore)
      );

      // Launch parachains
      const parachains = new Map<number, ChopsticksServiceImpl>();
      for (const paraConfig of config.parachains) {
        const paraResult = yield* Effect.tryPromise({
          try: () => launchChopsticksEffect(paraConfig),
          catch: (cause) =>
            new ChopsticksSetupError({
              cause,
              endpoint: getEndpointString(paraConfig.endpoint),
            }),
        });
        cleanups.push(
          Effect.tryPromise({
            try: () => paraResult.cleanup(),
            catch: () => undefined,
          }).pipe(Effect.ignore)
        );
        parachains.set(paraConfig.paraId, paraResult.result);
      }

      // Register cleanup with scope finalizer
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          logger.debug("Finalizing multi-chain setup...");
          for (const cleanup of cleanups.reverse()) {
            yield* cleanup;
          }
          logger.debug("Multi-chain finalization complete");
        })
      );

      return createMultiChainService(relayResult.result, parachains);
    })
  );

/**
 * Helper to create a standard Polkadot + Moonbeam XCM testing setup
 *
 * @param relayPort - Port for relay chain (default: 8000)
 * @param moonbeamPort - Port for Moonbeam parachain (default: 8001)
 * @returns Multi-chain configuration
 */
export const createPolkadotMoonbeamConfig = (
  relayPort = 8000,
  moonbeamPort = 8001
): MultiChainConfig => ({
  relay: {
    type: "relay",
    endpoint: "wss://rpc.polkadot.io",
    port: relayPort,
    "build-block-mode": "Manual" as BuildBlockMode,
  },
  parachains: [
    {
      type: "parachain",
      paraId: 2004, // Moonbeam on Polkadot
      endpoint: "wss://wss.api.moonbeam.network",
      port: moonbeamPort,
      "build-block-mode": "Manual" as BuildBlockMode,
    },
  ],
});

/**
 * Helper to create a standard Kusama + Moonriver XCM testing setup
 *
 * @param relayPort - Port for relay chain (default: 8000)
 * @param moonriverPort - Port for Moonriver parachain (default: 8001)
 * @returns Multi-chain configuration
 */
export const createKusamaMoonriverConfig = (
  relayPort = 8000,
  moonriverPort = 8001
): MultiChainConfig => ({
  relay: {
    type: "relay",
    endpoint: "wss://kusama-rpc.polkadot.io",
    port: relayPort,
    "build-block-mode": "Manual" as BuildBlockMode,
  },
  parachains: [
    {
      type: "parachain",
      paraId: 2023, // Moonriver on Kusama
      endpoint: "wss://wss.api.moonriver.moonbeam.network",
      port: moonriverPort,
      "build-block-mode": "Manual" as BuildBlockMode,
    },
  ],
});
