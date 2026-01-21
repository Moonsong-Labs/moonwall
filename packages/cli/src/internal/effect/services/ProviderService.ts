import { Context, Effect } from "effect";
import type { ProviderConfig, ProviderType, ConnectedProvider, ProviderApi } from "@moonwall/types";
import type { ProviderConnectionError } from "../errors/foundation.js";

/**
 * Error thrown when a provider fails to disconnect cleanly.
 *
 * This error indicates that resources may not have been fully released,
 * which could lead to connection leaks or memory issues.
 *
 * @example
 * ```ts
 * Effect.catchTag("ProviderDisconnectError", (error) => {
 *   console.warn(`Warning: ${error.providerName} did not disconnect cleanly`);
 * })
 * ```
 */
import { Data } from "effect";

export class ProviderDisconnectError extends Data.TaggedError("ProviderDisconnectError")<{
  /** The name of the provider that failed to disconnect */
  readonly providerName: string;
  /** The type of provider */
  readonly providerType: ProviderType;
  /** Human-readable error message */
  readonly message: string;
  /** The underlying cause of the error */
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when a provider health check fails.
 *
 * This indicates that a provider is not responding to queries.
 */
export class ProviderHealthCheckError extends Data.TaggedError("ProviderHealthCheckError")<{
  /** The name of the provider that failed the health check */
  readonly providerName: string;
  /** The type of provider */
  readonly providerType: ProviderType;
  /** The endpoint that was checked */
  readonly endpoint: string;
  /** Human-readable error message */
  readonly message: string;
  /** The underlying cause of the error */
  readonly cause?: unknown;
}> {}

/**
 * Configuration for the ProviderService.
 *
 * This is the input configuration used to create and connect providers,
 * derived from the environment configuration's ProviderConfig array.
 */
export interface ProviderServiceConfig {
  /** Configuration for providers to create and connect */
  readonly providers: ReadonlyArray<ProviderConfig>;

  /** Optional timeout for connection attempts (in milliseconds) */
  readonly connectionTimeout?: number;

  /** Optional number of retry attempts for failed connections */
  readonly retryAttempts?: number;

  /** Optional delay between retry attempts (in milliseconds) */
  readonly retryDelay?: number;
}

/**
 * Status of the ProviderService.
 */
export type ProviderServiceStatus =
  | { readonly _tag: "Idle" }
  | {
      readonly _tag: "Connecting";
      readonly totalProviders: number;
      readonly connectedCount: number;
    }
  | {
      readonly _tag: "Connected";
      readonly connectedCount: number;
      readonly endpoints: ReadonlyArray<string>;
    }
  | { readonly _tag: "Disconnected" }
  | { readonly _tag: "Failed"; readonly error: unknown };

/**
 * Result from successfully connecting providers.
 */
export interface ProviderServiceRunningInfo {
  /** Array of connected providers */
  readonly connectedProviders: ReadonlyArray<ConnectedProvider>;

  /** Number of successfully connected providers */
  readonly connectedCount: number;

  /** Endpoints that are connected */
  readonly endpoints: ReadonlyArray<string>;

  /** Original configuration */
  readonly config: ProviderServiceConfig;
}

/**
 * Information about a single connected provider for type-safe access.
 */
export interface TypedConnectedProvider<T extends ProviderType> {
  /** Provider name */
  readonly name: string;
  /** Provider type discriminator */
  readonly type: T;
  /** The connected API instance (type depends on provider type) */
  readonly api: ProviderApi;
  /** Disconnect function */
  readonly disconnect: () => Promise<void> | void;
  /** Greet/health check function */
  readonly greet: () => Promise<void> | Promise<{ rtName: string; rtVersion: number }>;
}

/**
 * ProviderService provides Effect-based lifecycle management for
 * blockchain client providers (polkadotJs, ethers, viem, web3, papi).
 *
 * This service wraps the existing ProviderFactory and ProviderInterfaceFactory
 * to provide a consistent, testable interface for provider lifecycle operations.
 *
 * Key responsibilities:
 * - Creating lazy provider instances from configuration
 * - Establishing connections to blockchain endpoints
 * - Health checking connected providers
 * - Graceful disconnection and cleanup
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { ProviderService, ProviderServiceLive } from "@moonwall/cli";
 *
 * const program = Effect.gen(function* () {
 *   const providerService = yield* ProviderService;
 *
 *   // Connect all configured providers
 *   const { info, disconnect } = yield* providerService.connect({
 *     providers: [
 *       { name: "polkadot", type: "polkadotJs", endpoints: ["wss://rpc.polkadot.io"] },
 *       { name: "ethereum", type: "ethers", endpoints: ["https://eth.llamarpc.com"] },
 *     ],
 *   });
 *
 *   console.log(`Connected ${info.connectedCount} providers`);
 *
 *   // Get a specific provider
 *   const polkadotProvider = yield* providerService.getProvider("polkadot");
 *   if (polkadotProvider) {
 *     console.log(`Polkadot provider API ready`);
 *   }
 *
 *   // Check health
 *   yield* providerService.healthCheck();
 *
 *   // Disconnect when done
 *   yield* disconnect;
 * }).pipe(Effect.provide(ProviderServiceLive));
 * ```
 */
export class ProviderService extends Context.Tag("ProviderService")<
  ProviderService,
  {
    /**
     * Create lazy provider instances from configuration.
     *
     * This creates MoonwallProvider objects but does NOT establish connections.
     * Use `connect()` to actually establish connections.
     *
     * @param config - Configuration for providers to create
     * @returns Effect yielding the number of providers created
     */
    readonly createProviders: (config: ProviderServiceConfig) => Effect.Effect<number>;

    /**
     * Connect all configured providers.
     *
     * This establishes connections to all providers defined in the configuration.
     * If any provider fails to connect after retries, the entire operation fails.
     *
     * @param config - Configuration including providers and connection settings
     * @returns Effect yielding the running info and a disconnect effect
     *
     * @example
     * ```ts
     * const { info, disconnect } = yield* providerService.connect({
     *   providers: [
     *     { name: "polkadot", type: "polkadotJs", endpoints: ["wss://rpc.polkadot.io"] },
     *   ],
     *   connectionTimeout: 30000,
     *   retryAttempts: 3,
     * });
     * ```
     */
    readonly connect: (config: ProviderServiceConfig) => Effect.Effect<
      {
        readonly info: ProviderServiceRunningInfo;
        readonly disconnect: Effect.Effect<void, ProviderDisconnectError>;
      },
      ProviderConnectionError
    >;

    /**
     * Disconnect all connected providers.
     *
     * Gracefully closes all provider connections. If any provider fails
     * to disconnect, errors are collected and reported together.
     *
     * @returns Effect that completes when all providers are disconnected
     */
    readonly disconnect: () => Effect.Effect<void, ProviderDisconnectError>;

    /**
     * Get the current status of the ProviderService.
     *
     * @returns The current status (Idle, Connecting, Connected, Disconnected, or Failed)
     */
    readonly getStatus: () => Effect.Effect<ProviderServiceStatus>;

    /**
     * Get a specific provider by name.
     *
     * @param name - The name of the provider to retrieve
     * @returns Effect yielding the connected provider, or undefined if not found
     */
    readonly getProvider: (name: string) => Effect.Effect<ConnectedProvider | undefined>;

    /**
     * Get all connected providers.
     *
     * @returns Effect yielding an array of all connected providers
     */
    readonly getAllProviders: () => Effect.Effect<ReadonlyArray<ConnectedProvider>>;

    /**
     * Perform a health check on all connected providers.
     *
     * Calls each provider's `greet()` method to verify connectivity.
     *
     * @returns Effect that succeeds if all providers are healthy, fails with ProviderHealthCheckError otherwise
     */
    readonly healthCheck: () => Effect.Effect<void, ProviderHealthCheckError>;

    /**
     * Perform a health check on a specific provider.
     *
     * @param name - The name of the provider to check
     * @returns Effect that succeeds if the provider is healthy
     */
    readonly healthCheckProvider: (name: string) => Effect.Effect<void, ProviderHealthCheckError>;
  }
>() {}

export type { ProviderService as ProviderServiceType };
