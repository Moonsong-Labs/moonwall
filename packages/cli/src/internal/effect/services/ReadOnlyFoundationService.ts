import { Context, Effect } from "effect";
import type { ReadOnlyLaunchSpec, ProviderConfig } from "@moonwall/types";
import type {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
  ProviderConnectionError,
} from "../errors/foundation.js";

/**
 * Configuration for the ReadOnlyFoundationService.
 *
 * This is the input configuration used to connect to an existing network,
 * derived from the environment configuration's ReadOnlyLaunchSpec.
 */
export interface ReadOnlyFoundationConfig {
  /** Human-readable name for this connection (used in logs) */
  readonly name: string;

  /** The original launch specification from the config */
  readonly launchSpec: ReadOnlyLaunchSpec;

  /** Provider configurations for connecting to the network */
  readonly connections: ReadonlyArray<ProviderConfig>;

  /** Whether to disable runtime version checks */
  readonly disableRuntimeVersionCheck?: boolean;
}

/**
 * Status of a read-only foundation connection.
 */
export type ReadOnlyFoundationStatus =
  | { readonly _tag: "Connecting" }
  | {
      readonly _tag: "Connected";
      readonly connectedProviders: number;
      readonly endpoints: ReadonlyArray<string>;
    }
  | { readonly _tag: "Disconnected" }
  | { readonly _tag: "Failed"; readonly error: unknown };

/**
 * Result from successfully connecting a read-only foundation.
 */
export interface ReadOnlyFoundationRunningInfo {
  /** Number of successfully connected providers */
  readonly connectedProviders: number;

  /** List of connected endpoint URLs */
  readonly endpoints: ReadonlyArray<string>;

  /** Original configuration used to connect */
  readonly config: ReadOnlyFoundationConfig;
}

/**
 * ReadOnlyFoundationService provides Effect-based lifecycle management for
 * read-only connections to existing blockchain networks.
 *
 * Unlike other foundation services (Dev, Chopsticks, Zombie), this service
 * does not spawn any processes. Instead, it establishes connections to
 * already-running networks for testing and monitoring purposes.
 *
 * This service handles:
 *
 * - Connecting to external network endpoints
 * - Health checks via RPC endpoints (system_health)
 * - Graceful disconnection with provider cleanup
 * - Rate limiting for API calls (optional)
 *
 * Use cases:
 * - Testing against live testnets or mainnets
 * - Monitoring network health
 * - Running read-only queries against existing networks
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { ReadOnlyFoundationService } from "./ReadOnlyFoundationService.js";
 *
 * const program = Effect.gen(function* () {
 *   const readOnly = yield* ReadOnlyFoundationService;
 *
 *   // Connect to the network
 *   const { info, disconnect } = yield* readOnly.connect(config);
 *   console.log(`Connected to ${info.connectedProviders} providers`);
 *
 *   // Check health
 *   yield* readOnly.healthCheck();
 *
 *   // Disconnect when done
 *   yield* disconnect;
 * });
 * ```
 */
export class ReadOnlyFoundationService extends Context.Tag("ReadOnlyFoundationService")<
  ReadOnlyFoundationService,
  {
    /**
     * Connect to an existing network.
     *
     * This establishes connections to all configured providers and validates
     * that at least one provider is responsive.
     *
     * @param config - Configuration for the connection
     * @returns Effect yielding the connection info and a disconnect effect
     *
     * @example
     * ```ts
     * const { info, disconnect } = yield* readOnly.connect({
     *   name: "polkadot-mainnet",
     *   launchSpec: spec,
     *   connections: [
     *     { name: "polkadot", type: "polkadotJs", endpoints: ["wss://rpc.polkadot.io"] }
     *   ],
     * });
     * ```
     */
    readonly connect: (config: ReadOnlyFoundationConfig) => Effect.Effect<
      {
        readonly info: ReadOnlyFoundationRunningInfo;
        readonly disconnect: Effect.Effect<void, FoundationShutdownError>;
      },
      FoundationStartupError | ProviderConnectionError
    >;

    /**
     * Disconnect from the network.
     *
     * This closes all provider connections and releases resources.
     *
     * @returns Effect that completes when all connections are closed
     */
    readonly disconnect: () => Effect.Effect<void, FoundationShutdownError>;

    /**
     * Get the current status of the read-only foundation.
     *
     * @returns The current status (Connecting, Connected, Disconnected, or Failed)
     */
    readonly getStatus: () => Effect.Effect<ReadOnlyFoundationStatus>;

    /**
     * Perform a health check on the connected network.
     *
     * Calls the `system_health` RPC method on the primary provider to verify
     * the network is responsive.
     *
     * @param endpoint - Optional specific endpoint to check (defaults to first connected)
     * @returns Effect that succeeds if healthy, fails with FoundationHealthCheckError otherwise
     */
    readonly healthCheck: (endpoint?: string) => Effect.Effect<void, FoundationHealthCheckError>;
  }
>() {}

export type { ReadOnlyFoundationService as ReadOnlyFoundationServiceType };
