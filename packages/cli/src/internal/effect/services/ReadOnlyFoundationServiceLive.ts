import { type Context, Effect, Layer, Ref } from "effect";
import { createLogger } from "@moonwall/util";
import type { ConnectedProvider } from "@moonwall/types";
import {
  ReadOnlyFoundationService,
  type ReadOnlyFoundationConfig,
  type ReadOnlyFoundationRunningInfo,
  type ReadOnlyFoundationStatus,
} from "./ReadOnlyFoundationService.js";
import {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
  ProviderConnectionError,
} from "../errors/foundation.js";
import { ProviderFactory, ProviderInterfaceFactory } from "../../providerFactories.js";

const logger = createLogger({ name: "ReadOnlyFoundationService" });

/**
 * Internal state for the ReadOnlyFoundationService.
 *
 * This tracks the current status, connected providers, and cleanup functions.
 */
interface ReadOnlyFoundationState {
  readonly status: ReadOnlyFoundationStatus;
  readonly runningInfo: ReadOnlyFoundationRunningInfo | null;
  readonly connectedProviders: ReadonlyArray<ConnectedProvider>;
}

const initialState: ReadOnlyFoundationState = {
  status: { _tag: "Disconnected" },
  runningInfo: null,
  connectedProviders: [],
};

/**
 * Create the ReadOnlyFoundationService implementation.
 *
 * This factory creates a service instance with its own state ref.
 * The service uses ProviderFactory to prepare providers and
 * ProviderInterfaceFactory to establish connections.
 */
const makeReadOnlyFoundationService = Effect.gen(function* () {
  // Create a mutable ref to track state across method calls
  const stateRef = yield* Ref.make<ReadOnlyFoundationState>(initialState);

  /**
   * Connect to an existing network.
   */
  const connect = (
    config: ReadOnlyFoundationConfig
  ): Effect.Effect<
    {
      readonly info: ReadOnlyFoundationRunningInfo;
      readonly disconnect: Effect.Effect<void, FoundationShutdownError>;
    },
    FoundationStartupError | ProviderConnectionError
  > =>
    Effect.gen(function* () {
      // Validate configuration
      if (!config.connections || config.connections.length === 0) {
        return yield* Effect.fail(
          new FoundationStartupError({
            foundationType: "read_only",
            message: `No connections configured for read_only foundation "${config.name}"`,
            environmentName: config.name,
          })
        );
      }

      // Update status to Connecting
      yield* Ref.set(stateRef, {
        status: { _tag: "Connecting" },
        runningInfo: null,
        connectedProviders: [],
      });

      logger.debug(
        `Connecting to read-only foundation: ${config.name} with ${config.connections.length} provider(s)`
      );

      // Prepare providers (lazy - no connection yet)
      const preparedProviders = ProviderFactory.prepare([...config.connections]);

      // Connect all providers
      const connectedProviders: ConnectedProvider[] = [];
      const endpoints: string[] = [];

      for (const provider of preparedProviders) {
        try {
          logger.debug(`Connecting provider: ${provider.name} (${provider.type})`);

          const connected = yield* Effect.tryPromise({
            try: async () =>
              ProviderInterfaceFactory.populate(provider.name, provider.type, provider.connect),
            catch: (error) =>
              new ProviderConnectionError({
                providerType: provider.type,
                endpoint:
                  config.connections.find((c) => c.name === provider.name)?.endpoints[0] ||
                  "unknown",
                message: `Failed to connect provider "${provider.name}": ${error instanceof Error ? error.message : String(error)}`,
                cause: error,
              }),
          });

          connectedProviders.push(connected);

          // Extract endpoint for tracking
          const providerConfig = config.connections.find((c) => c.name === provider.name);
          if (providerConfig?.endpoints[0]) {
            endpoints.push(providerConfig.endpoints[0]);
          }

          // Optionally greet (log runtime info) unless disabled
          if (!config.disableRuntimeVersionCheck) {
            yield* Effect.tryPromise({
              try: async () => {
                await connected.greet();
              },
              catch: () => new Error("Greet failed"), // Ignored anyway
            }).pipe(Effect.catchAll(() => Effect.void)); // Ignore greet failures - not critical
          }

          logger.debug(`Provider "${provider.name}" connected successfully`);
        } catch (error) {
          // Update state to Failed
          yield* Ref.set(stateRef, {
            status: { _tag: "Failed", error },
            runningInfo: null,
            connectedProviders: [],
          });

          // Clean up any providers that were already connected
          for (const connected of connectedProviders) {
            yield* Effect.tryPromise({
              try: async () => {
                await Promise.resolve(connected.disconnect());
              },
              catch: () => new Error("Cleanup failed"),
            }).pipe(Effect.catchAll(() => Effect.void)); // Ignore cleanup errors
          }

          return yield* Effect.fail(
            error instanceof ProviderConnectionError
              ? error
              : new FoundationStartupError({
                  foundationType: "read_only",
                  message: `Failed to connect providers for "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
                  cause: error,
                  environmentName: config.name,
                })
          );
        }
      }

      // Ensure at least one provider connected
      if (connectedProviders.length === 0) {
        yield* Ref.set(stateRef, {
          status: { _tag: "Failed", error: new Error("No providers connected") },
          runningInfo: null,
          connectedProviders: [],
        });

        return yield* Effect.fail(
          new FoundationStartupError({
            foundationType: "read_only",
            message: `No providers could be connected for "${config.name}"`,
            environmentName: config.name,
          })
        );
      }

      // Build running info
      const runningInfo: ReadOnlyFoundationRunningInfo = {
        connectedProviders: connectedProviders.length,
        endpoints,
        config,
      };

      // Update state to Connected
      yield* Ref.set(stateRef, {
        status: {
          _tag: "Connected",
          connectedProviders: connectedProviders.length,
          endpoints,
        },
        runningInfo,
        connectedProviders,
      });

      logger.info(
        `Read-only foundation "${config.name}" connected with ${connectedProviders.length} provider(s)`
      );

      // Create the disconnect effect for this connection
      const disconnectEffect: Effect.Effect<void, FoundationShutdownError> = Effect.gen(
        function* () {
          const currentState = yield* Ref.get(stateRef);

          if (currentState.connectedProviders.length === 0) {
            logger.warn(`Disconnect called but no providers are connected for "${config.name}"`);
            return;
          }

          logger.debug(
            `Disconnecting read-only foundation "${config.name}" (${currentState.connectedProviders.length} providers)`
          );

          const failedDisconnects: string[] = [];

          for (const provider of currentState.connectedProviders) {
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
            status: { _tag: "Disconnected" },
            runningInfo: null,
            connectedProviders: [],
          });

          if (failedDisconnects.length > 0) {
            return yield* Effect.fail(
              new FoundationShutdownError({
                foundationType: "read_only",
                message: `Failed to disconnect some providers for "${config.name}"`,
                failedResources: failedDisconnects,
              })
            );
          }

          logger.info(`Read-only foundation "${config.name}" disconnected`);
        }
      );

      return {
        info: runningInfo,
        disconnect: disconnectEffect,
      };
    });

  /**
   * Disconnect from the network.
   */
  const disconnect = (): Effect.Effect<void, FoundationShutdownError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Connected") {
        logger.warn(
          `Disconnect called but foundation is not connected (status: ${currentState.status._tag})`
        );
        return;
      }

      const name = currentState.runningInfo?.config.name || "unknown";
      logger.debug(`Disconnecting read-only foundation "${name}"`);

      const failedDisconnects: string[] = [];

      for (const provider of currentState.connectedProviders) {
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
        status: { _tag: "Disconnected" },
        runningInfo: null,
        connectedProviders: [],
      });

      if (failedDisconnects.length > 0) {
        return yield* Effect.fail(
          new FoundationShutdownError({
            foundationType: "read_only",
            message: `Failed to disconnect some providers for "${name}"`,
            failedResources: failedDisconnects,
          })
        );
      }

      logger.info(`Read-only foundation "${name}" disconnected`);
    });

  /**
   * Get the current status of the read-only foundation.
   */
  const getStatus = (): Effect.Effect<ReadOnlyFoundationStatus> =>
    Ref.get(stateRef).pipe(Effect.map((state) => state.status));

  /**
   * Perform a health check on the connected network.
   *
   * Uses the first connected provider (or specified endpoint) to verify
   * the network is responsive by calling a simple RPC method.
   */
  const healthCheck = (endpoint?: string): Effect.Effect<void, FoundationHealthCheckError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Connected") {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "read_only",
            message: `Cannot health check: foundation is not connected (status: ${currentState.status._tag})`,
          })
        );
      }

      if (currentState.connectedProviders.length === 0) {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "read_only",
            message: "Cannot health check: no providers connected",
          })
        );
      }

      // Find the provider to use for health check
      let targetProvider: ConnectedProvider;
      if (endpoint) {
        // Find provider matching the endpoint
        const providerConfig = currentState.runningInfo?.config.connections.find((c) =>
          c.endpoints.includes(endpoint)
        );
        if (!providerConfig) {
          return yield* Effect.fail(
            new FoundationHealthCheckError({
              foundationType: "read_only",
              message: `No provider found for endpoint: ${endpoint}`,
              endpoint,
            })
          );
        }
        const provider = currentState.connectedProviders.find(
          (p) => p.name === providerConfig.name
        );
        if (!provider) {
          return yield* Effect.fail(
            new FoundationHealthCheckError({
              foundationType: "read_only",
              message: `Provider "${providerConfig.name}" is not connected`,
              endpoint,
            })
          );
        }
        targetProvider = provider;
      } else {
        // Use first connected provider
        targetProvider = currentState.connectedProviders[0];
      }

      logger.debug(`Performing health check via provider "${targetProvider.name}"`);

      // Perform health check based on provider type
      yield* Effect.tryPromise({
        try: async () => {
          // Use greet() as a health check - it queries runtime info which verifies connectivity
          await targetProvider.greet();
        },
        catch: (error) =>
          new FoundationHealthCheckError({
            foundationType: "read_only",
            message: `Health check failed for provider "${targetProvider.name}": ${error instanceof Error ? error.message : String(error)}`,
            endpoint: endpoint || currentState.runningInfo?.endpoints[0],
            cause: error,
          }),
      });

      logger.debug(`Health check passed for provider "${targetProvider.name}"`);
    });

  return {
    connect,
    disconnect,
    getStatus,
    healthCheck,
  } satisfies Context.Tag.Service<ReadOnlyFoundationService>;
});

/**
 * Live implementation of ReadOnlyFoundationService.
 *
 * This Layer provides a fully functional ReadOnlyFoundationService that:
 * - Connects to external blockchain networks via configured providers
 * - Performs health checks using provider greet/RPC calls
 * - Handles graceful disconnection with provider cleanup
 *
 * Unlike other foundation services (Dev, Chopsticks, Zombie), this service
 * does not spawn any processes - it only manages client connections to
 * already-running networks.
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { ReadOnlyFoundationService, ReadOnlyFoundationServiceLive } from "./services/index.js";
 *
 * const program = Effect.gen(function* () {
 *   const readOnly = yield* ReadOnlyFoundationService;
 *   const { info, disconnect } = yield* readOnly.connect({
 *     name: "polkadot-mainnet",
 *     launchSpec: spec,
 *     connections: [
 *       { name: "polkadot", type: "polkadotJs", endpoints: ["wss://rpc.polkadot.io"] }
 *     ],
 *   });
 *   console.log(`Connected to ${info.connectedProviders} providers`);
 *
 *   // Check health
 *   yield* readOnly.healthCheck();
 *
 *   // Disconnect when done
 *   yield* disconnect;
 * }).pipe(Effect.provide(ReadOnlyFoundationServiceLive));
 * ```
 */
export const ReadOnlyFoundationServiceLive: Layer.Layer<ReadOnlyFoundationService> = Layer.effect(
  ReadOnlyFoundationService,
  makeReadOnlyFoundationService
);

/**
 * Create a ReadOnlyFoundationService layer for testing.
 *
 * For mocking in tests, users should use `Layer.succeed` to provide a mock
 * implementation directly rather than using this factory, since the real
 * service requires network connections.
 *
 * @returns A new Layer instance for testing isolation
 */
export const makeReadOnlyFoundationServiceLayer = (): Layer.Layer<ReadOnlyFoundationService> =>
  Layer.effect(ReadOnlyFoundationService, makeReadOnlyFoundationService);
