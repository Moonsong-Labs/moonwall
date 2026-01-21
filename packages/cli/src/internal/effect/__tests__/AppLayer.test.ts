/**
 * Unit tests for AppLayer - Application Layer composition.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Effect, Layer, Exit } from "effect";
import {
  AppLayer,
  AppLayerLive,
  AppLayerTest,
  AppLayerMinimal,
  CoreServicesLive,
  CoreServicesTest,
  LowLevelServicesLive,
  FoundationServicesLive,
  ProviderServicesLive,
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
} from "../AppLayer.js";

describe("AppLayer", () => {
  describe("AppLayer namespace", () => {
    it("should expose Live layer", () => {
      expect(AppLayer.Live).toBeDefined();
      expect(AppLayer.Live).toBe(AppLayerLive);
    });

    it("should expose Test layer", () => {
      expect(AppLayer.Test).toBeDefined();
      expect(AppLayer.Test).toBe(AppLayerTest);
    });

    it("should expose Minimal layer", () => {
      expect(AppLayer.Minimal).toBeDefined();
      expect(AppLayer.Minimal).toBe(AppLayerMinimal);
    });

    it("should expose sub-layers for custom composition", () => {
      expect(AppLayer.Core).toBe(CoreServicesLive);
      expect(AppLayer.CoreTest).toBe(CoreServicesTest);
      expect(AppLayer.LowLevel).toBe(LowLevelServicesLive);
      expect(AppLayer.Foundations).toBe(FoundationServicesLive);
      expect(AppLayer.Providers).toBe(ProviderServicesLive);
    });
  });

  describe("CoreServicesLive", () => {
    it("should provide ConfigService", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return typeof configService.loadConfig === "function";
      }).pipe(Effect.provide(CoreServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide LoggerService", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;
        return typeof loggerService.getLogger === "function";
      }).pipe(Effect.provide(CoreServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });
  });

  describe("CoreServicesTest", () => {
    it("should provide ConfigService", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return typeof configService.loadConfig === "function";
      }).pipe(Effect.provide(CoreServicesTest));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide LoggerService with disabled logging", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;
        const status = yield* loggerService.getStatus();
        return status._tag === "Disabled";
      }).pipe(Effect.provide(CoreServicesTest));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });
  });

  describe("LowLevelServicesLive", () => {
    it("should provide ProcessManagerService", async () => {
      const program = Effect.gen(function* () {
        const processManager = yield* ProcessManagerService;
        return typeof processManager.launch === "function";
      }).pipe(Effect.provide(LowLevelServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide PortDiscoveryService", async () => {
      const program = Effect.gen(function* () {
        const portDiscovery = yield* PortDiscoveryService;
        return typeof portDiscovery.discoverPort === "function";
      }).pipe(Effect.provide(LowLevelServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide NodeReadinessService", async () => {
      const program = Effect.gen(function* () {
        const nodeReadiness = yield* NodeReadinessService;
        return typeof nodeReadiness.checkReady === "function";
      }).pipe(Effect.provide(LowLevelServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide RpcPortDiscoveryService", async () => {
      const program = Effect.gen(function* () {
        const rpcPortDiscovery = yield* RpcPortDiscoveryService;
        return typeof rpcPortDiscovery.discoverRpcPort === "function";
      }).pipe(Effect.provide(LowLevelServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide StartupCacheService", async () => {
      const program = Effect.gen(function* () {
        const startupCache = yield* StartupCacheService;
        return typeof startupCache.getCachedArtifacts === "function";
      }).pipe(Effect.provide(LowLevelServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });
  });

  describe("FoundationServicesLive", () => {
    it("should provide DevFoundationService", async () => {
      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;
        return (
          typeof devFoundation.start === "function" &&
          typeof devFoundation.stop === "function" &&
          typeof devFoundation.getStatus === "function" &&
          typeof devFoundation.healthCheck === "function"
        );
      }).pipe(Effect.provide(FoundationServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide ChopsticksFoundationService", async () => {
      const program = Effect.gen(function* () {
        const chopsticksFoundation = yield* ChopsticksFoundationService;
        return (
          typeof chopsticksFoundation.start === "function" &&
          typeof chopsticksFoundation.stop === "function" &&
          typeof chopsticksFoundation.createBlock === "function"
        );
      }).pipe(Effect.provide(FoundationServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide ZombieFoundationService", async () => {
      const program = Effect.gen(function* () {
        const zombieFoundation = yield* ZombieFoundationService;
        return (
          typeof zombieFoundation.start === "function" &&
          typeof zombieFoundation.stop === "function" &&
          typeof zombieFoundation.getNodes === "function"
        );
      }).pipe(Effect.provide(FoundationServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide ReadOnlyFoundationService", async () => {
      const program = Effect.gen(function* () {
        const readOnlyFoundation = yield* ReadOnlyFoundationService;
        return (
          typeof readOnlyFoundation.connect === "function" &&
          typeof readOnlyFoundation.disconnect === "function" &&
          typeof readOnlyFoundation.healthCheck === "function"
        );
      }).pipe(Effect.provide(FoundationServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });
  });

  describe("ProviderServicesLive", () => {
    it("should provide ProviderService", async () => {
      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        return (
          typeof providerService.connect === "function" &&
          typeof providerService.disconnect === "function" &&
          typeof providerService.getProvider === "function"
        );
      }).pipe(Effect.provide(ProviderServicesLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });
  });

  describe("AppLayerLive (full production layer)", () => {
    it("should provide all core services", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        const loggerService = yield* LoggerService;
        return (
          typeof configService.loadConfig === "function" &&
          typeof loggerService.getLogger === "function"
        );
      }).pipe(Effect.provide(AppLayerLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide all foundation services", async () => {
      const program = Effect.gen(function* () {
        const dev = yield* DevFoundationService;
        const chopsticks = yield* ChopsticksFoundationService;
        const zombie = yield* ZombieFoundationService;
        const readOnly = yield* ReadOnlyFoundationService;
        return (
          typeof dev.start === "function" &&
          typeof chopsticks.start === "function" &&
          typeof zombie.start === "function" &&
          typeof readOnly.connect === "function"
        );
      }).pipe(Effect.provide(AppLayerLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide provider services", async () => {
      const program = Effect.gen(function* () {
        const provider = yield* ProviderService;
        return typeof provider.connect === "function";
      }).pipe(Effect.provide(AppLayerLive));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });
  });

  describe("AppLayerTest (test layer with disabled logging)", () => {
    it("should provide services with disabled logging", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;
        const status = yield* loggerService.getStatus();
        return status._tag === "Disabled";
      }).pipe(Effect.provide(AppLayerTest));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should still provide all foundation services", async () => {
      const program = Effect.gen(function* () {
        const dev = yield* DevFoundationService;
        const chopsticks = yield* ChopsticksFoundationService;
        return typeof dev.start === "function" && typeof chopsticks.start === "function";
      }).pipe(Effect.provide(AppLayerTest));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });
  });

  describe("AppLayerMinimal (core services only)", () => {
    it("should provide ConfigService", async () => {
      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        return typeof configService.loadConfig === "function";
      }).pipe(Effect.provide(AppLayerMinimal));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should provide LoggerService", async () => {
      const program = Effect.gen(function* () {
        const loggerService = yield* LoggerService;
        return typeof loggerService.getLogger === "function";
      }).pipe(Effect.provide(AppLayerMinimal));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });
  });

  describe("Custom layer composition", () => {
    it("should allow composing custom layers from sub-layers", async () => {
      // Create a custom layer with only dev foundation and core services
      const CustomLayer = Layer.mergeAll(CoreServicesLive, FoundationServicesLive);

      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        const devFoundation = yield* DevFoundationService;
        return (
          typeof configService.loadConfig === "function" &&
          typeof devFoundation.start === "function"
        );
      }).pipe(Effect.provide(CustomLayer));

      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });

    it("should allow mocking services with Layer.succeed", async () => {
      const mockConfig = {
        label: "test-config",
        defaultTestTimeout: 30000,
        environments: [],
      };

      const MockConfigService = Layer.succeed(ConfigService, {
        loadConfig: () => Effect.succeed(mockConfig as any),
        getConfig: () => Effect.succeed(mockConfig as any),
        isLoaded: () => Effect.succeed(true),
        getStatus: () =>
          Effect.succeed({ _tag: "Loaded", configPath: "moonwall.config.json" } as const),
        getEnvironment: () => Effect.fail({} as any),
        getEnvironmentNames: () => Effect.succeed([]),
        validateConfig: () => Effect.succeed(true),
        clearCache: () => Effect.succeed(undefined),
        getConfigPath: () => Effect.succeed("moonwall.config.json"),
      });

      const program = Effect.gen(function* () {
        const configService = yield* ConfigService;
        const config = yield* configService.loadConfig();
        return config.label;
      }).pipe(Effect.provide(MockConfigService));

      const result = await Effect.runPromise(program);
      expect(result).toBe("test-config");
    });
  });

  describe("Re-exported service tags", () => {
    it("should re-export all service tags for convenience", () => {
      // Core services
      expect(ConfigService).toBeDefined();
      expect(LoggerService).toBeDefined();

      // Provider services
      expect(ProviderService).toBeDefined();

      // Foundation services
      expect(DevFoundationService).toBeDefined();
      expect(ChopsticksFoundationService).toBeDefined();
      expect(ZombieFoundationService).toBeDefined();
      expect(ReadOnlyFoundationService).toBeDefined();

      // Low-level services
      expect(ProcessManagerService).toBeDefined();
      expect(PortDiscoveryService).toBeDefined();
      expect(NodeReadinessService).toBeDefined();
      expect(RpcPortDiscoveryService).toBeDefined();
      expect(StartupCacheService).toBeDefined();
    });
  });
});
