import { Context, type Effect } from "effect";
import type { ZombieLaunchSpec, OrcOptionsInterface } from "@moonwall/types";
import type {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
} from "../errors/foundation.js";

/**
 * Type of node in a Zombienet network.
 */
export type ZombieNodeType = "relaychain" | "parachain";

/**
 * Information about a running node in the Zombienet network.
 */
export interface ZombieNodeInfo {
  /** The name of the node (e.g., "alice", "bob", "collator01") */
  readonly name: string;

  /** Whether this is a relaychain or parachain node */
  readonly type: ZombieNodeType;

  /** The WebSocket endpoint for this node */
  readonly wsEndpoint: string;

  /** The multiaddress for p2p connections (if available) */
  readonly multiAddress?: string;

  /** The parachain ID (only for parachain nodes) */
  readonly parachainId?: number;
}

/**
 * Configuration for the ZombieFoundationService.
 *
 * This is the input configuration used to start a zombie foundation,
 * derived from the environment configuration's ZombieLaunchSpec.
 */
export interface ZombieFoundationConfig {
  /** Path to the zombienet configuration file (JSON or TOML) */
  readonly configPath: string;

  /** Human-readable name for this network (used in logs) */
  readonly name: string;

  /** The original launch specification from the config */
  readonly launchSpec: ZombieLaunchSpec;

  /** Additional options for the zombienet orchestrator */
  readonly orchestratorOptions?: OrcOptionsInterface;

  /** Whether to disable default Ethereum provider connections */
  readonly disableDefaultEthProviders?: boolean;

  /** Whether to disable log eavesdropping for WARN/ERROR messages */
  readonly disableLogEavesdropping?: boolean;

  /** Block names to skip validation */
  readonly skipBlockCheck?: ReadonlyArray<string>;
}

/**
 * Status of a running zombie foundation network.
 */
export type ZombieFoundationStatus =
  | { readonly _tag: "Starting" }
  | {
      readonly _tag: "Running";
      readonly relayWsEndpoint: string;
      readonly paraWsEndpoint?: string;
      readonly nodeCount: number;
    }
  | { readonly _tag: "Stopped" }
  | { readonly _tag: "Failed"; readonly error: unknown };

/**
 * Result from successfully starting a zombie foundation.
 */
export interface ZombieFoundationRunningInfo {
  /** WebSocket endpoint for the relay chain */
  readonly relayWsEndpoint: string;

  /** WebSocket endpoint for the parachain (if any) */
  readonly paraWsEndpoint?: string;

  /** Directory where zombienet stores its data */
  readonly tempDir: string;

  /** Information about all running nodes */
  readonly nodes: ReadonlyArray<ZombieNodeInfo>;

  /** Original configuration used to start the network */
  readonly config: ZombieFoundationConfig;
}

/**
 * Error type for node operations in ZombieFoundationService.
 */
export class ZombieNodeOperationError extends Error {
  readonly _tag = "ZombieNodeOperationError";

  constructor(
    readonly operation: "restart" | "kill" | "pause" | "resume" | "isUp",
    readonly nodeName: string,
    readonly reason: string,
    readonly cause?: unknown
  ) {
    super(`Failed to ${operation} node '${nodeName}': ${reason}`);
    this.name = "ZombieNodeOperationError";
  }
}

/**
 * ZombieFoundationService provides Effect-based lifecycle management for
 * Zombienet multi-node blockchain networks.
 *
 * This service wraps the @zombienet/orchestrator to spawn and manage
 * complete Substrate networks including relay chains and parachains.
 * It handles:
 *
 * - Starting multi-node networks from zombienet configuration files
 * - Managing individual node lifecycle (restart, kill)
 * - Health checks via RPC endpoints
 * - Graceful shutdown with cleanup of all nodes
 *
 * Zombienet is ideal for testing cross-chain scenarios, XCM, and
 * multi-validator consensus.
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { ZombieFoundationService } from "./ZombieFoundationService.js";
 *
 * const program = Effect.gen(function* () {
 *   const zombie = yield* ZombieFoundationService;
 *
 *   // Start the network
 *   const { info, stop } = yield* zombie.start(config);
 *   console.log(`Relay chain at ${info.relayWsEndpoint}`);
 *   console.log(`Running ${info.nodes.length} nodes`);
 *
 *   // Get node information
 *   const nodes = yield* zombie.getNodes();
 *   for (const node of nodes) {
 *     console.log(`${node.name} (${node.type}): ${node.wsEndpoint}`);
 *   }
 *
 *   // Restart a node for testing recovery scenarios
 *   yield* zombie.restartNode("alice");
 *
 *   // Stop when done
 *   yield* stop;
 * });
 * ```
 */
export class ZombieFoundationService extends Context.Tag("ZombieFoundationService")<
  ZombieFoundationService,
  {
    /**
     * Start a Zombienet multi-node network.
     *
     * This loads the zombienet configuration, spawns all nodes
     * (relay chain validators, collators, etc.), and waits for
     * the network to be ready.
     *
     * @param config - Configuration for the network
     * @returns Effect yielding the running network info and a stop effect
     *
     * @example
     * ```ts
     * const { info, stop } = yield* zombie.start({
     *   configPath: "./zombienet.toml",
     *   name: "test-network",
     *   launchSpec: spec,
     * });
     * ```
     */
    readonly start: (config: ZombieFoundationConfig) => Effect.Effect<
      {
        readonly info: ZombieFoundationRunningInfo;
        readonly stop: Effect.Effect<void, FoundationShutdownError>;
      },
      FoundationStartupError
    >;

    /**
     * Stop the running zombie network.
     *
     * Sends shutdown commands to all nodes in the network and
     * cleans up the temporary directory.
     *
     * @returns Effect that completes when all nodes are stopped
     */
    readonly stop: () => Effect.Effect<void, FoundationShutdownError>;

    /**
     * Get the current status of the zombie foundation.
     *
     * @returns The current status (Starting, Running, Stopped, or Failed)
     */
    readonly getStatus: () => Effect.Effect<ZombieFoundationStatus>;

    /**
     * Perform a health check on the running network.
     *
     * Checks that the relay chain (and parachain if present) are
     * responsive via their RPC endpoints.
     *
     * @returns Effect that succeeds if healthy, fails with FoundationHealthCheckError otherwise
     */
    readonly healthCheck: () => Effect.Effect<void, FoundationHealthCheckError>;

    /**
     * Get information about all running nodes in the network.
     *
     * @returns Array of node information including endpoints and types
     *
     * @example
     * ```ts
     * const nodes = yield* zombie.getNodes();
     * const validators = nodes.filter(n => n.type === "relaychain");
     * const collators = nodes.filter(n => n.type === "parachain");
     * ```
     */
    readonly getNodes: () => Effect.Effect<ReadonlyArray<ZombieNodeInfo>>;

    /**
     * Restart a specific node in the network.
     *
     * Useful for testing node recovery scenarios and network resilience.
     *
     * @param nodeName - The name of the node to restart
     * @returns Effect that completes when the node is back online
     *
     * @example
     * ```ts
     * yield* zombie.restartNode("alice");
     * // Wait for node to sync
     * yield* zombie.healthCheck();
     * ```
     */
    readonly restartNode: (nodeName: string) => Effect.Effect<void, ZombieNodeOperationError>;

    /**
     * Kill (terminate) a specific node in the network.
     *
     * The node will not restart automatically. This is useful for
     * testing network behavior with offline validators.
     *
     * @param nodeName - The name of the node to kill
     * @returns Effect that completes when the node is terminated
     *
     * @example
     * ```ts
     * // Simulate validator going offline
     * yield* zombie.killNode("bob");
     * // Run tests with reduced validator set
     * ```
     */
    readonly killNode: (nodeName: string) => Effect.Effect<void, ZombieNodeOperationError>;
  }
>() {}

export type { ZombieFoundationService as ZombieFoundationServiceType };
