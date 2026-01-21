import { Context, Effect, Layer, Ref } from "effect";
import { createLogger } from "@moonwall/util";
import type { ConnectedProvider, MoonwallProvider } from "@moonwall/types";
import {
  ProviderService,
  ProviderDisconnectError,
  ProviderHealthCheckError,
  type ProviderServiceConfig,
  type ProviderServiceRunningInfo,
  type ProviderServiceStatus,
} from "./ProviderService.js";
import { ProviderConnectionError } from "../errors/foundation.js";
import { ProviderFactory, ProviderInterfaceFactory } from "../../providerFactories.js";

const logger = createLogger({ name: "ProviderService" });

/**
 * Internal state for the ProviderService.
 *
 * This tracks the current status, lazy providers, connected providers, and configuration.
 */
interface ProviderServiceState {
  readonly status: ProviderServiceStatus;
  readonly config: ProviderServiceConfig | null;
  readonly lazyProviders: ReadonlyArray<MoonwallProvider>;
  readonly connectedProviders: ReadonlyArray<ConnectedProvider>;
  readonly endpoints: ReadonlyArray<string>;
}

const initialState: ProviderServiceState = {
  status: { _tag: "Idle" },
  config: null,
  lazyProviders: [],
  connectedProviders: [],
  endpoints: [],
};

/**
 * Default configuration values for provider connections.
 */
const DEFAULT_CONNECTION_TIMEOUT = 10000; // 10 seconds
const DEFAULT_RETRY_ATTEMPTS = 150; // Matches existing moonwall behavior
const DEFAULT_RETRY_DELAY = 100; // 100ms between retries

/**
 * Create the ProviderService implementation.
 *
 * This factory creates a service instance with its own state ref.
 * The service wraps ProviderFactory for lazy provider creation and
 * ProviderInterfaceFactory for establishing connections.
 */
const makeProviderService = Effect.gen(function* () {
  // Create a mutable ref to track state across method calls
  const stateRef = yield* Ref.make<ProviderServiceState>(initialState);

  /**
   * Helper to wait/delay between retries
   */
  const delay = (ms: number) =>
    Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  /**
   * Connect a single provider with retry logic.
   */
  const connectProviderWithRetry = (
    provider: MoonwallProvider,
    config: ProviderServiceConfig,
    endpoint: string
  ): Effect.Effect<ConnectedProvider, ProviderConnectionError> =>
    Effect.gen(function* () {
      const timeout = config.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT;
      const maxAttempts = config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
      const retryDelay = config.retryDelay ?? DEFAULT_RETRY_DELAY;

      let lastError: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const connectAttempt = Effect.tryPromise({
          try: async () => {
            // Race connection against timeout
            const connected = await Promise.race([
              ProviderInterfaceFactory.populate(provider.name, provider.type, provider.connect),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Connection attempt timed out after ${timeout}ms`)),
                  timeout
                )
              ),
            ]);
            return connected;
          },
          catch: (error) => error,
        });

        const result = yield* connectAttempt.pipe(Effect.either);

        if (result._tag === "Right") {
          logger.debug(`Provider "${provider.name}" connected on attempt ${attempt}`);
          return result.right;
        }

        lastError = result.left;

        if (attempt < maxAttempts) {
          logger.debug(
            `Provider "${provider.name}" connection attempt ${attempt}/${maxAttempts} failed, retrying...`
          );
          yield* delay(retryDelay);
        }
      }

      // All retries exhausted
      return yield* Effect.fail(
        new ProviderConnectionError({
          providerType: provider.type,
          endpoint,
          message: `Failed to connect provider "${provider.name}" after ${maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
          cause: lastError,
        })
      );
    });

  /**
   * Create lazy provider instances from configuration.
   */
  const createProviders = (config: ProviderServiceConfig): Effect.Effect<number> =>
    Effect.gen(function* () {
      if (!config.providers || config.providers.length === 0) {
        logger.debug("No providers to create");
        return 0;
      }

      logger.debug(`Creating ${config.providers.length} lazy provider(s)`);

      // Use ProviderFactory to prepare lazy providers
      const lazyProviders = ProviderFactory.prepare([...config.providers]);

      // Extract endpoints
      const endpoints = config.providers.map((p) => p.endpoints[0]).filter(Boolean);

      // Update state with lazy providers
      yield* Ref.update(stateRef, (state) => ({
        ...state,
        config,
        lazyProviders,
        endpoints,
      }));

      logger.debug(`Created ${lazyProviders.length} lazy provider(s)`);
      return lazyProviders.length;
    });

  /**
   * Connect all configured providers.
   */
  const connect = (
    config: ProviderServiceConfig
  ): Effect.Effect<
    {
      readonly info: ProviderServiceRunningInfo;
      readonly disconnect: Effect.Effect<void, ProviderDisconnectError>;
    },
    ProviderConnectionError
  > =>
    Effect.gen(function* () {
      // Validate configuration
      if (!config.providers || config.providers.length === 0) {
        return yield* Effect.fail(
          new ProviderConnectionError({
            providerType: "polkadotJs", // Default, not meaningful here
            endpoint: "",
            message: "No providers configured",
          })
        );
      }

      // Create lazy providers first
      yield* createProviders(config);

      const currentState = yield* Ref.get(stateRef);
      const { lazyProviders } = currentState;

      // Update status to Connecting
      yield* Ref.update(stateRef, (state) => ({
        ...state,
        status: {
          _tag: "Connecting" as const,
          totalProviders: lazyProviders.length,
          connectedCount: 0,
        },
      }));

      logger.debug(`Connecting ${lazyProviders.length} provider(s)`);

      // Connect all providers in parallel
      const connectedProviders: ConnectedProvider[] = [];
      const connectedEndpoints: string[] = [];

      for (const provider of lazyProviders) {
        const providerConfig = config.providers.find((p) => p.name === provider.name);
        const endpoint = providerConfig?.endpoints[0] || "unknown";

        try {
          const connected = yield* connectProviderWithRetry(provider, config, endpoint);
          connectedProviders.push(connected);
          connectedEndpoints.push(endpoint);

          // Update connecting status
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            status: {
              _tag: "Connecting" as const,
              totalProviders: lazyProviders.length,
              connectedCount: connectedProviders.length,
            },
          }));
        } catch (error) {
          // Clean up already connected providers on failure
          for (const connected of connectedProviders) {
            yield* Effect.tryPromise({
              try: async () => {
                await Promise.resolve(connected.disconnect());
              },
              catch: () => new Error("Cleanup failed"),
            }).pipe(Effect.catchAll(() => Effect.void));
          }

          // Update state to Failed
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            status: { _tag: "Failed" as const, error },
            connectedProviders: [],
          }));

          return yield* Effect.fail(
            error instanceof ProviderConnectionError
              ? error
              : new ProviderConnectionError({
                  providerType: provider.type,
                  endpoint,
                  message: `Failed to connect provider "${provider.name}": ${error instanceof Error ? error.message : String(error)}`,
                  cause: error,
                })
          );
        }
      }

      // Build running info
      const runningInfo: ProviderServiceRunningInfo = {
        connectedProviders,
        connectedCount: connectedProviders.length,
        endpoints: connectedEndpoints,
        config,
      };

      // Update state to Connected
      yield* Ref.set(stateRef, {
        status: {
          _tag: "Connected",
          connectedCount: connectedProviders.length,
          endpoints: connectedEndpoints,
        },
        config,
        lazyProviders,
        connectedProviders,
        endpoints: connectedEndpoints,
      });

      logger.info(`Connected ${connectedProviders.length} provider(s)`);

      // Create the disconnect effect for this connection
      const disconnectEffect: Effect.Effect<void, ProviderDisconnectError> = Effect.gen(
        function* () {
          const state = yield* Ref.get(stateRef);

          if (state.connectedProviders.length === 0) {
            logger.warn("Disconnect called but no providers are connected");
            return;
          }

          logger.debug(`Disconnecting ${state.connectedProviders.length} provider(s)`);

          const failedDisconnects: string[] = [];

          for (const provider of state.connectedProviders) {
            const disconnectResult = yield* Effect.tryPromise({
              try: async () => {
                await Promise.resolve(provider.disconnect());
              },
              catch: (error) => error,
            }).pipe(Effect.either);

            if (disconnectResult._tag === "Left") {
              failedDisconnects.push(provider.name);
              logger.warn(
                `Failed to disconnect provider "${provider.name}": ${disconnectResult.left}`
              );
            } else {
              logger.debug(`Provider "${provider.name}" disconnected`);
            }
          }

          // Update state to Disconnected
          yield* Ref.set(stateRef, {
            ...initialState,
            status: { _tag: "Disconnected" },
          });

          if (failedDisconnects.length > 0) {
            return yield* Effect.fail(
              new ProviderDisconnectError({
                providerName: failedDisconnects.join(", "),
                providerType: "polkadotJs", // Not meaningful for multiple
                message: `Failed to disconnect some providers: ${failedDisconnects.join(", ")}`,
              })
            );
          }

          logger.info("All providers disconnected");
        }
      );

      return {
        info: runningInfo,
        disconnect: disconnectEffect,
      };
    });

  /**
   * Disconnect all connected providers.
   */
  const disconnect = (): Effect.Effect<void, ProviderDisconnectError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);

      if (state.status._tag !== "Connected") {
        logger.warn(
          `Disconnect called but service is not connected (status: ${state.status._tag})`
        );
        return;
      }

      if (state.connectedProviders.length === 0) {
        logger.warn("Disconnect called but no providers are connected");
        yield* Ref.set(stateRef, {
          ...initialState,
          status: { _tag: "Disconnected" },
        });
        return;
      }

      logger.debug(`Disconnecting ${state.connectedProviders.length} provider(s)`);

      const failedDisconnects: string[] = [];

      for (const provider of state.connectedProviders) {
        const disconnectResult = yield* Effect.tryPromise({
          try: async () => {
            await Promise.resolve(provider.disconnect());
          },
          catch: (error) => error,
        }).pipe(Effect.either);

        if (disconnectResult._tag === "Left") {
          failedDisconnects.push(provider.name);
          logger.warn(`Failed to disconnect provider "${provider.name}": ${disconnectResult.left}`);
        } else {
          logger.debug(`Provider "${provider.name}" disconnected`);
        }
      }

      // Update state to Disconnected
      yield* Ref.set(stateRef, {
        ...initialState,
        status: { _tag: "Disconnected" },
      });

      if (failedDisconnects.length > 0) {
        return yield* Effect.fail(
          new ProviderDisconnectError({
            providerName: failedDisconnects.join(", "),
            providerType: "polkadotJs", // Not meaningful for multiple
            message: `Failed to disconnect some providers: ${failedDisconnects.join(", ")}`,
          })
        );
      }

      logger.info("All providers disconnected");
    });

  /**
   * Get the current status of the ProviderService.
   */
  const getStatus = (): Effect.Effect<ProviderServiceStatus> =>
    Ref.get(stateRef).pipe(Effect.map((state) => state.status));

  /**
   * Get a specific provider by name.
   */
  const getProvider = (name: string): Effect.Effect<ConnectedProvider | undefined> =>
    Ref.get(stateRef).pipe(
      Effect.map((state) => state.connectedProviders.find((p) => p.name === name))
    );

  /**
   * Get all connected providers.
   */
  const getAllProviders = (): Effect.Effect<ReadonlyArray<ConnectedProvider>> =>
    Ref.get(stateRef).pipe(Effect.map((state) => state.connectedProviders));

  /**
   * Perform a health check on all connected providers.
   */
  const healthCheck = (): Effect.Effect<void, ProviderHealthCheckError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);

      if (state.status._tag !== "Connected") {
        return yield* Effect.fail(
          new ProviderHealthCheckError({
            providerName: "all",
            providerType: "polkadotJs",
            endpoint: "",
            message: `Cannot health check: service is not connected (status: ${state.status._tag})`,
          })
        );
      }

      if (state.connectedProviders.length === 0) {
        return yield* Effect.fail(
          new ProviderHealthCheckError({
            providerName: "all",
            providerType: "polkadotJs",
            endpoint: "",
            message: "Cannot health check: no providers connected",
          })
        );
      }

      logger.debug(`Performing health check on ${state.connectedProviders.length} provider(s)`);

      for (const provider of state.connectedProviders) {
        yield* Effect.tryPromise({
          try: async () => {
            await provider.greet();
          },
          catch: (error) =>
            new ProviderHealthCheckError({
              providerName: provider.name,
              providerType: provider.type,
              endpoint: state.endpoints[state.connectedProviders.indexOf(provider)] || "unknown",
              message: `Health check failed for provider "${provider.name}": ${error instanceof Error ? error.message : String(error)}`,
              cause: error,
            }),
        });
      }

      logger.debug("Health check passed for all providers");
    });

  /**
   * Perform a health check on a specific provider.
   */
  const healthCheckProvider = (name: string): Effect.Effect<void, ProviderHealthCheckError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);

      const provider = state.connectedProviders.find((p) => p.name === name);
      if (!provider) {
        return yield* Effect.fail(
          new ProviderHealthCheckError({
            providerName: name,
            providerType: "polkadotJs",
            endpoint: "",
            message: `Provider "${name}" not found`,
          })
        );
      }

      const providerIndex = state.connectedProviders.indexOf(provider);
      const endpoint = state.endpoints[providerIndex] || "unknown";

      logger.debug(`Performing health check on provider "${name}"`);

      yield* Effect.tryPromise({
        try: async () => {
          await provider.greet();
        },
        catch: (error) =>
          new ProviderHealthCheckError({
            providerName: provider.name,
            providerType: provider.type,
            endpoint,
            message: `Health check failed for provider "${provider.name}": ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          }),
      });

      logger.debug(`Health check passed for provider "${name}"`);
    });

  return {
    createProviders,
    connect,
    disconnect,
    getStatus,
    getProvider,
    getAllProviders,
    healthCheck,
    healthCheckProvider,
  } satisfies Context.Tag.Service<ProviderService>;
});

/**
 * Live implementation of ProviderService.
 *
 * This Layer provides a fully functional ProviderService that:
 * - Creates lazy provider instances using ProviderFactory
 * - Establishes connections using ProviderInterfaceFactory with retry logic
 * - Performs health checks using provider greet() methods
 * - Handles graceful disconnection with cleanup
 *
 * The service wraps the existing Moonwall provider infrastructure to provide
 * a consistent, testable Effect-based interface for provider lifecycle operations.
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { ProviderService, ProviderServiceLive } from "@moonwall/cli";
 *
 * const program = Effect.gen(function* () {
 *   const providerService = yield* ProviderService;
 *
 *   const { info, disconnect } = yield* providerService.connect({
 *     providers: [
 *       { name: "polkadot", type: "polkadotJs", endpoints: ["wss://rpc.polkadot.io"] },
 *       { name: "ethereum", type: "ethers", endpoints: ["https://eth.llamarpc.com"] },
 *     ],
 *     connectionTimeout: 30000,
 *     retryAttempts: 3,
 *   });
 *
 *   console.log(`Connected ${info.connectedCount} providers`);
 *
 *   // Get a specific provider
 *   const polkadotProvider = yield* providerService.getProvider("polkadot");
 *
 *   // Check health
 *   yield* providerService.healthCheck();
 *
 *   // Disconnect when done
 *   yield* disconnect;
 * }).pipe(Effect.provide(ProviderServiceLive));
 * ```
 */
export const ProviderServiceLive: Layer.Layer<ProviderService> = Layer.effect(
  ProviderService,
  makeProviderService
);

/**
 * Create a ProviderService layer for testing.
 *
 * For mocking in tests, users should use `Layer.succeed` to provide a mock
 * implementation directly rather than using this factory, since the real
 * service requires network connections.
 *
 * @returns A new Layer instance for testing isolation
 */
export const makeProviderServiceLayer = (): Layer.Layer<ProviderService> =>
  Layer.effect(ProviderService, makeProviderService);
