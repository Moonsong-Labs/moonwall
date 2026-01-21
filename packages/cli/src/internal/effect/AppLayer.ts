/**
 * AppLayer - Composed Effect Layers for Moonwall application.
 *
 * This module provides pre-composed Layer configurations for running Moonwall
 * in different contexts (production, testing). It combines all the individual
 * service layers into cohesive application layers.
 *
 * ## Usage
 *
 * Production usage with all services:
 * ```ts
 * import { Effect } from "effect";
 * import { AppLayer, ConfigService, LoggerService } from "@moonwall/cli";
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* ConfigService;
 *   const logger = yield* LoggerService;
 *   // ... use services
 * }).pipe(Effect.provide(AppLayer.Live));
 * ```
 *
 * Testing with mocked services:
 * ```ts
 * import { Effect, Layer } from "effect";
 * import { AppLayer, ConfigService } from "@moonwall/cli";
 *
 * const MockConfigService = Layer.succeed(ConfigService, {
 *   loadConfig: () => Effect.succeed(mockConfig),
 *   // ... mock other methods
 * });
 *
 * const TestLayer = AppLayer.Test.pipe(
 *   Layer.provideMerge(MockConfigService)
 * );
 * ```
 */

import { Effect, Layer, ManagedRuntime, Scope } from "effect";

// Core infrastructure services
import { ConfigService } from "./services/ConfigService.js";
import { ConfigServiceLive } from "./services/ConfigServiceLive.js";
import { LoggerService } from "./services/LoggerService.js";
import { LoggerServiceLive, LoggerServiceDisabled } from "./services/LoggerServiceLive.js";
import { ProviderService } from "./services/ProviderService.js";
import { ProviderServiceLive } from "./services/ProviderServiceLive.js";

// Foundation services
import { DevFoundationService } from "./services/DevFoundationService.js";
import { DevFoundationServiceLive } from "./services/DevFoundationServiceLive.js";
import { ChopsticksFoundationService } from "./services/ChopsticksFoundationService.js";
import { ChopsticksFoundationServiceLive } from "./services/ChopsticksFoundationServiceLive.js";
import { ZombieFoundationService } from "./services/ZombieFoundationService.js";
import { ZombieFoundationServiceLive } from "./services/ZombieFoundationServiceLive.js";
import { ReadOnlyFoundationService } from "./services/ReadOnlyFoundationService.js";
import { ReadOnlyFoundationServiceLive } from "./services/ReadOnlyFoundationServiceLive.js";

// Low-level services (used by foundation services internally)
import { ProcessManagerService, ProcessManagerServiceLive } from "./ProcessManagerService.js";
import { PortDiscoveryService, PortDiscoveryServiceLive } from "./PortDiscoveryService.js";
import { NodeReadinessService, NodeReadinessServiceLive } from "./NodeReadinessService.js";
import { RpcPortDiscoveryService, RpcPortDiscoveryServiceLive } from "./RpcPortDiscoveryService.js";
import { StartupCacheService, StartupCacheServiceLive } from "./StartupCacheService.js";

// =============================================================================
// Layer Types
// =============================================================================

/**
 * Core infrastructure services required by all Moonwall operations.
 */
export type CoreServices = ConfigService | LoggerService;

/**
 * Provider services for blockchain client connections.
 */
export type ProviderServices = ProviderService;

/**
 * All foundation services for different network types.
 */
export type FoundationServices =
  | DevFoundationService
  | ChopsticksFoundationService
  | ZombieFoundationService
  | ReadOnlyFoundationService;

/**
 * Low-level services used internally by foundation services.
 */
export type LowLevelServices =
  | ProcessManagerService
  | PortDiscoveryService
  | NodeReadinessService
  | RpcPortDiscoveryService
  | StartupCacheService;

/**
 * All services combined - the full application layer type.
 */
export type AllServices = CoreServices | ProviderServices | FoundationServices | LowLevelServices;

// =============================================================================
// Core Services Layer
// =============================================================================

/**
 * Core services layer combining ConfigService and LoggerService.
 *
 * These are the essential services needed for most Moonwall operations.
 */
export const CoreServicesLive: Layer.Layer<CoreServices> = Layer.mergeAll(
  ConfigServiceLive,
  LoggerServiceLive
);

/**
 * Core services layer with disabled logging (for testing).
 */
export const CoreServicesTest: Layer.Layer<CoreServices> = Layer.mergeAll(
  ConfigServiceLive,
  LoggerServiceDisabled
);

// =============================================================================
// Low-Level Services Layer
// =============================================================================

/**
 * Low-level services layer for process and port management.
 *
 * These services are used internally by foundation services but can also
 * be used directly for custom node management scenarios.
 */
export const LowLevelServicesLive: Layer.Layer<LowLevelServices> = Layer.mergeAll(
  ProcessManagerServiceLive,
  PortDiscoveryServiceLive,
  NodeReadinessServiceLive,
  RpcPortDiscoveryServiceLive,
  StartupCacheServiceLive
);

// =============================================================================
// Foundation Services Layer
// =============================================================================

/**
 * All foundation services for different network types.
 *
 * Note: Each foundation service layer already includes its required low-level
 * dependencies internally. This layer provides all foundation types for
 * programs that need to work with multiple foundation types.
 */
export const FoundationServicesLive: Layer.Layer<FoundationServices> = Layer.mergeAll(
  DevFoundationServiceLive,
  ChopsticksFoundationServiceLive,
  ZombieFoundationServiceLive,
  ReadOnlyFoundationServiceLive
);

// =============================================================================
// Provider Services Layer
// =============================================================================

/**
 * Provider services for blockchain client connections.
 */
export const ProviderServicesLive: Layer.Layer<ProviderServices> = ProviderServiceLive;

// =============================================================================
// Application Layers
// =============================================================================

/**
 * Full production application layer with all services.
 *
 * Use this layer when running Moonwall in production mode with full
 * logging and all foundation types available.
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { AppLayer, DevFoundationService, ConfigService } from "@moonwall/cli";
 *
 * const program = Effect.gen(function* () {
 *   const configService = yield* ConfigService;
 *   const config = yield* configService.loadConfig();
 *
 *   const devFoundation = yield* DevFoundationService;
 *   const { info, stop } = yield* devFoundation.start({
 *     name: "my-node",
 *     command: "substrate-node",
 *     args: ["--dev"],
 *     launchSpec: {},
 *     isEthereumChain: false,
 *   });
 *
 *   // ... use the node
 *   yield* stop;
 * }).pipe(Effect.provide(AppLayer.Live));
 *
 * await Effect.runPromise(program);
 * ```
 */
export const AppLayerLive: Layer.Layer<AllServices> = Layer.mergeAll(
  CoreServicesLive,
  LowLevelServicesLive,
  FoundationServicesLive,
  ProviderServicesLive
);

/**
 * Test application layer with disabled logging.
 *
 * Use this layer in tests where you want real service implementations
 * but without log output cluttering test results.
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { AppLayer, ConfigService } from "@moonwall/cli";
 *
 * describe("MyTest", () => {
 *   it("should load config", async () => {
 *     const program = Effect.gen(function* () {
 *       const config = yield* ConfigService;
 *       return yield* config.loadConfig();
 *     }).pipe(Effect.provide(AppLayer.Test));
 *
 *     const result = await Effect.runPromise(program);
 *     expect(result).toBeDefined();
 *   });
 * });
 * ```
 */
export const AppLayerTest: Layer.Layer<AllServices> = Layer.mergeAll(
  CoreServicesTest,
  LowLevelServicesLive,
  FoundationServicesLive,
  ProviderServicesLive
);

/**
 * Minimal layer with only core services.
 *
 * Use this when you only need config and logging, without foundation
 * or provider services.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function* () {
 *   const config = yield* ConfigService;
 *   return yield* config.loadConfig();
 * }).pipe(Effect.provide(AppLayer.Minimal));
 * ```
 */
export const AppLayerMinimal: Layer.Layer<CoreServices> = CoreServicesLive;

// =============================================================================
// Memoized Layers (Performance Optimization)
// =============================================================================

/**
 * Memoized version of the full production layer.
 *
 * Memoization ensures that expensive service initialization (such as config loading,
 * logger setup) happens only once, even when the layer is composed or used multiple times.
 * This is particularly important for services with internal state that should be shared.
 *
 * @returns An Effect that resolves to a memoized Layer
 *
 * @example
 * ```ts
 * const program = Effect.gen(function* () {
 *   const memoizedLayer = yield* AppLayerMemoized;
 *   // Use the layer multiple times - initialization happens once
 *   yield* Effect.provide(myEffect1, memoizedLayer);
 *   yield* Effect.provide(myEffect2, memoizedLayer);
 * });
 * ```
 */
export const AppLayerMemoized: Effect.Effect<
  Layer.Layer<AllServices>,
  never,
  Scope.Scope
> = Layer.memoize(AppLayerLive);

/**
 * Memoized version of the test layer.
 *
 * @returns An Effect that resolves to a memoized Layer (requires Scope)
 */
export const AppLayerTestMemoized: Effect.Effect<
  Layer.Layer<AllServices>,
  never,
  Scope.Scope
> = Layer.memoize(AppLayerTest);

/**
 * Memoized version of low-level services.
 *
 * Useful when multiple foundation services need to share the same ProcessManager,
 * PortDiscovery, and other low-level services without re-initialization.
 *
 * @returns An Effect that resolves to a memoized Layer (requires Scope)
 */
export const LowLevelServicesMemoized: Effect.Effect<
  Layer.Layer<LowLevelServices>,
  never,
  Scope.Scope
> = Layer.memoize(LowLevelServicesLive);

// =============================================================================
// Lazy Service Initialization
// =============================================================================

/**
 * Create a lazily-initialized foundation service layer.
 *
 * Uses Layer.suspend to delay service creation until actually needed.
 * This reduces startup time when not all foundation types are used.
 *
 * @example
 * ```ts
 * // Only creates ChopsticksFoundationService when actually used
 * const lazyChopsticks = lazyChopsticksFoundation();
 *
 * const program = Effect.gen(function* () {
 *   // Service created here on first access
 *   const chopsticks = yield* ChopsticksFoundationService;
 *   // ...
 * }).pipe(Effect.provide(lazyChopsticks));
 * ```
 */
export const lazyDevFoundation = (): Layer.Layer<DevFoundationService> =>
  Layer.suspend(() => DevFoundationServiceLive);

export const lazyChopsticksFoundation = (): Layer.Layer<ChopsticksFoundationService> =>
  Layer.suspend(() => ChopsticksFoundationServiceLive);

export const lazyZombieFoundation = (): Layer.Layer<ZombieFoundationService> =>
  Layer.suspend(() => ZombieFoundationServiceLive);

export const lazyReadOnlyFoundation = (): Layer.Layer<ReadOnlyFoundationService> =>
  Layer.suspend(() => ReadOnlyFoundationServiceLive);

/**
 * Create a ManagedRuntime with memoized services for long-running applications.
 *
 * ManagedRuntime provides a pre-built runtime with services already initialized,
 * which is more efficient for CLIs and servers that run many effects against
 * the same services.
 *
 * @param layer - The layer to use for the runtime
 * @returns A ManagedRuntime instance
 *
 * @example
 * ```ts
 * // Create runtime once at application startup
 * const runtime = createManagedRuntime(AppLayer.Live);
 *
 * // Run effects efficiently without re-initializing services
 * const result1 = await runtime.runPromise(effect1);
 * const result2 = await runtime.runPromise(effect2);
 *
 * // Clean up when done
 * await runtime.dispose();
 * ```
 */
export const createManagedRuntime = <R, E>(
  layer: Layer.Layer<R, E, never>
): ManagedRuntime.ManagedRuntime<R, E> => ManagedRuntime.make(layer);

// =============================================================================
// AppLayer Namespace
// =============================================================================

/**
 * Application Layer namespace providing pre-composed layers for different contexts.
 *
 * ## Available Layers
 *
 * - `Live`: Full production layer with all services and logging enabled
 * - `Test`: Full layer with logging disabled (for cleaner test output)
 * - `Minimal`: Only core services (ConfigService, LoggerService)
 *
 * ## Composing Custom Layers
 *
 * You can create custom layers by combining the exported sub-layers:
 *
 * ```ts
 * import { Layer } from "effect";
 * import {
 *   CoreServicesLive,
 *   DevFoundationServiceLive,
 *   ProviderServicesLive
 * } from "@moonwall/cli";
 *
 * // Layer with only dev foundation (no chopsticks, zombie, read-only)
 * const DevOnlyLayer = Layer.mergeAll(
 *   CoreServicesLive,
 *   DevFoundationServiceLive,
 *   ProviderServicesLive
 * );
 * ```
 *
 * ## Mocking Services in Tests
 *
 * Use `Layer.succeed` to create mock implementations:
 *
 * ```ts
 * import { Effect, Layer } from "effect";
 * import { ConfigService, AppLayer } from "@moonwall/cli";
 *
 * const mockConfig = { label: "test", environments: [] };
 *
 * const MockConfigService = Layer.succeed(ConfigService, {
 *   loadConfig: () => Effect.succeed(mockConfig),
 *   getConfig: () => Effect.succeed(mockConfig),
 *   isLoaded: () => Effect.succeed(true),
 *   getStatus: () => Effect.succeed({ _tag: "Loaded" }),
 *   getEnvironment: (name) => Effect.succeed(mockConfig.environments[0]),
 *   getEnvironmentNames: () => Effect.succeed([]),
 *   validateConfig: () => Effect.succeed(true),
 *   clearCache: () => Effect.succeed(undefined),
 *   getConfigPath: () => Effect.succeed("moonwall.config.json"),
 * });
 *
 * // Replace ConfigService in the test layer
 * const TestLayerWithMock = Layer.merge(
 *   AppLayer.Test,
 *   MockConfigService
 * );
 * ```
 */
export const AppLayer = {
  /**
   * Full production application layer with all services.
   */
  Live: AppLayerLive,

  /**
   * Test application layer with disabled logging.
   */
  Test: AppLayerTest,

  /**
   * Minimal layer with only core services (ConfigService, LoggerService).
   */
  Minimal: AppLayerMinimal,

  // Sub-layers for custom composition
  /**
   * Core services (ConfigService, LoggerService).
   */
  Core: CoreServicesLive,

  /**
   * Core services with logging disabled.
   */
  CoreTest: CoreServicesTest,

  /**
   * Low-level services (ProcessManager, PortDiscovery, etc.).
   */
  LowLevel: LowLevelServicesLive,

  /**
   * Foundation services (Dev, Chopsticks, Zombie, ReadOnly).
   */
  Foundations: FoundationServicesLive,

  /**
   * Provider services for blockchain connections.
   */
  Providers: ProviderServicesLive,

  // Memoized layers for performance optimization
  /**
   * Memoized production layer - ensures single initialization.
   */
  Memoized: AppLayerMemoized,

  /**
   * Memoized test layer - ensures single initialization.
   */
  TestMemoized: AppLayerTestMemoized,

  /**
   * Memoized low-level services - shared across foundations.
   */
  LowLevelMemoized: LowLevelServicesMemoized,

  // Lazy layer factories
  /**
   * Lazily-initialized Dev foundation (created on first use).
   */
  lazyDev: lazyDevFoundation,

  /**
   * Lazily-initialized Chopsticks foundation (created on first use).
   */
  lazyChopsticks: lazyChopsticksFoundation,

  /**
   * Lazily-initialized Zombie foundation (created on first use).
   */
  lazyZombie: lazyZombieFoundation,

  /**
   * Lazily-initialized ReadOnly foundation (created on first use).
   */
  lazyReadOnly: lazyReadOnlyFoundation,

  // ManagedRuntime factory
  /**
   * Create a ManagedRuntime for long-running applications.
   */
  createRuntime: createManagedRuntime,
} as const;

// =============================================================================
// Re-exports for convenience
// =============================================================================

// Re-export service tags for direct access
export {
  ConfigService,
  LoggerService,
  ProviderService,
  DevFoundationService,
  ChopsticksFoundationService,
  ZombieFoundationService,
  ReadOnlyFoundationService,
  ProcessManagerService,
  PortDiscoveryService,
  NodeReadinessService,
  RpcPortDiscoveryService,
  StartupCacheService,
};
