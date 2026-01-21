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

import { Layer } from "effect";

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
