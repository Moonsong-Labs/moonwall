import { expect } from "vitest";
import { describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { BuildBlockMode } from "@acala-network/chopsticks";
import {
  type ChopsticksServiceImpl,
  ChopsticksBlockError,
  ChopsticksStorageError,
  type ChopsticksConfig,
} from "../index.js";

// =============================================================================
// Phase 2 Tests: launchChopsticksEffect Module
// =============================================================================

describe("launchChopsticksEffect - Phase 2: Module Structure", () => {
  describe("Module Exports", () => {
    it("should export launchChopsticksEffect function", async () => {
      const module = await import("../index.js");
      expect(module.launchChopsticksEffect).toBeDefined();
      expect(typeof module.launchChopsticksEffect).toBe("function");
    });

    it("should export launchChopsticksEffectProgram function", async () => {
      const module = await import("../index.js");
      expect(module.launchChopsticksEffectProgram).toBeDefined();
      expect(typeof module.launchChopsticksEffectProgram).toBe("function");
    });

    it("should export ChopsticksLaunchResult type", async () => {
      // Type-only test - verify the type is importable
      type TestType = import("../index.js").ChopsticksLaunchResult;
      const _typeCheck: TestType = {
        chain: {} as any,
        addr: "127.0.0.1:8000",
        port: 8000,
      };
      expect(_typeCheck.port).toBe(8000);
    });

    it("should export ChopsticksServiceImpl type", async () => {
      // Type-only test - verify the type is importable
      type TestType = import("../index.js").ChopsticksServiceImpl;
      const _typeCheck: TestType = {
        chain: {} as any,
        addr: "127.0.0.1:8000",
        port: 8000,
        createBlock: () => Effect.succeed({ block: { hash: "0x123" as const, number: 1 } }),
        setStorage: () => Effect.void,
        submitExtrinsic: () => Effect.succeed("0x" as `0x${string}`),
        dryRunExtrinsic: () => Effect.succeed({ success: true, storageDiff: [] }),
        getBlock: () => Effect.succeed({ hash: "0x123" as `0x${string}`, number: 1 }),
        setHead: () => Effect.void,
        submitUpwardMessages: () => Effect.void,
        submitDownwardMessages: () => Effect.void,
        submitHorizontalMessages: () => Effect.void,
      };
      expect(_typeCheck.addr).toBe("127.0.0.1:8000");
    });
  });

  describe("ChopsticksServiceImpl Interface", () => {
    it("should have all required properties", () => {
      const mockService: ChopsticksServiceImpl = {
        chain: {} as any,
        addr: "127.0.0.1:9000",
        port: 9000,
        createBlock: () => Effect.succeed({ block: { hash: "0xabc" as const, number: 42 } }),
        setStorage: () => Effect.void,
        submitExtrinsic: () => Effect.succeed("0xhash" as `0x${string}`),
        dryRunExtrinsic: () => Effect.succeed({ success: true, storageDiff: [] }),
        getBlock: () => Effect.succeed({ hash: "0xdef" as `0x${string}`, number: 100 }),
        setHead: () => Effect.void,
        submitUpwardMessages: () => Effect.void,
        submitDownwardMessages: () => Effect.void,
        submitHorizontalMessages: () => Effect.void,
      };

      expect(mockService.addr).toBe("127.0.0.1:9000");
      expect(mockService.port).toBe(9000);
      expect(mockService.chain).toBeDefined();
    });

    it.effect("should allow createBlock to return BlockCreationResult", () => {
      const mockService: ChopsticksServiceImpl = {
        chain: {} as any,
        addr: "127.0.0.1:8000",
        port: 8000,
        createBlock: () =>
          Effect.succeed({
            block: { hash: "0x123456" as const, number: 999 },
          }),
        setStorage: () => Effect.void,
        submitExtrinsic: () => Effect.succeed("0x" as `0x${string}`),
        dryRunExtrinsic: () => Effect.succeed({ success: true, storageDiff: [] }),
        getBlock: () => Effect.succeed(undefined),
        setHead: () => Effect.void,
        submitUpwardMessages: () => Effect.void,
        submitDownwardMessages: () => Effect.void,
        submitHorizontalMessages: () => Effect.void,
      };

      return mockService.createBlock().pipe(
        Effect.map((result) => {
          expect(result.block.hash).toBe("0x123456");
          expect(result.block.number).toBe(999);
        })
      );
    });

    it.effect("should allow createBlock to fail with ChopsticksBlockError", () => {
      const mockService: ChopsticksServiceImpl = {
        chain: {} as any,
        addr: "127.0.0.1:8000",
        port: 8000,
        createBlock: () =>
          Effect.fail(
            new ChopsticksBlockError({
              cause: new Error("Block creation failed"),
              operation: "newBlock",
            })
          ),
        setStorage: () => Effect.void,
        submitExtrinsic: () => Effect.succeed("0x" as `0x${string}`),
        dryRunExtrinsic: () => Effect.succeed({ success: true, storageDiff: [] }),
        getBlock: () => Effect.succeed(undefined),
        setHead: () => Effect.void,
        submitUpwardMessages: () => Effect.void,
        submitDownwardMessages: () => Effect.void,
        submitHorizontalMessages: () => Effect.void,
      };

      return mockService.createBlock().pipe(
        Effect.catchTag("ChopsticksBlockError", (error) =>
          Effect.succeed({ caught: true, operation: error.operation })
        ),
        Effect.map((result) => {
          expect(result).toEqual({ caught: true, operation: "newBlock" });
        })
      );
    });

    it.effect("should allow setStorage to fail with ChopsticksStorageError", () => {
      const mockService: ChopsticksServiceImpl = {
        chain: {} as any,
        addr: "127.0.0.1:8000",
        port: 8000,
        createBlock: () => Effect.succeed({ block: { hash: "0x" as const, number: 1 } }),
        setStorage: () =>
          Effect.fail(
            new ChopsticksStorageError({
              cause: new Error("Storage write failed"),
              module: "System",
              method: "Account",
            })
          ),
        submitExtrinsic: () => Effect.succeed("0x" as `0x${string}`),
        dryRunExtrinsic: () => Effect.succeed({ success: true, storageDiff: [] }),
        getBlock: () => Effect.succeed(undefined),
        setHead: () => Effect.void,
        submitUpwardMessages: () => Effect.void,
        submitDownwardMessages: () => Effect.void,
        submitHorizontalMessages: () => Effect.void,
      };

      return mockService.setStorage({ module: "System", method: "Account", params: [] }).pipe(
        Effect.catchTag("ChopsticksStorageError", (error) =>
          Effect.succeed({ caught: true, module: error.module, method: error.method })
        ),
        Effect.map((result) => {
          expect(result).toEqual({ caught: true, module: "System", method: "Account" });
        })
      );
    });
  });

  describe("Config Conversion (kebab-case)", () => {
    it("should accept config with required fields", () => {
      // ChopsticksConfig now uses kebab-case keys and has port/build-block-mode as required
      const config: ChopsticksConfig = {
        endpoint: "wss://rpc.polkadot.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      };

      expect(config.endpoint).toBe("wss://rpc.polkadot.io");
      expect(config.port).toBe(8000);
      expect(config["build-block-mode"]).toBe(BuildBlockMode.Manual);
    });

    it("should accept full config with all options using kebab-case", () => {
      const config: ChopsticksConfig = {
        endpoint: "wss://rpc.polkadot.io",
        block: 12345,
        port: 9000,
        host: "0.0.0.0",
        "build-block-mode": BuildBlockMode.Manual,
        "wasm-override": "/path/to/wasm",
        "allow-unresolved-imports": true,
        "mock-signature-host": true,
        db: "./chopsticks.db",
        "import-storage": { System: { Account: {} } },
        "runtime-log-level": 3,
        "rpc-timeout": 30000, // New field supported via chopsticks type
      };

      expect(config.endpoint).toBe("wss://rpc.polkadot.io");
      expect(config.block).toBe(12345);
      expect(config.port).toBe(9000);
      expect(config.host).toBe("0.0.0.0");
      expect(config["build-block-mode"]).toBe(BuildBlockMode.Manual);
      expect(config["wasm-override"]).toBe("/path/to/wasm");
      expect(config["allow-unresolved-imports"]).toBe(true);
      expect(config["mock-signature-host"]).toBe(true);
      expect(config.db).toBe("./chopsticks.db");
      expect(config["runtime-log-level"]).toBe(3);
      expect(config["rpc-timeout"]).toBe(30000);
    });

    it("should accept config with block as hash string", () => {
      const config: ChopsticksConfig = {
        endpoint: "wss://rpc.polkadot.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
        block: "0x1234567890abcdef",
      };

      expect(config.block).toBe("0x1234567890abcdef");
    });

    it("should accept config with block as null for latest", () => {
      const config: ChopsticksConfig = {
        endpoint: "wss://rpc.polkadot.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
        block: null,
      };

      expect(config.block).toBeNull();
    });
  });

  describe("launchChopsticksEffectProgram Effect Type", () => {
    it("should return an Effect that requires no context when config is provided inline", async () => {
      const { launchChopsticksEffectProgram } = await import("../index.js");

      const program = launchChopsticksEffectProgram({
        endpoint: "wss://test.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      });

      // Verify it's an Effect by checking it has common Effect methods
      expect(typeof program.pipe).toBe("function");
    });

    it("should produce ChopsticksSetupError on failure", async () => {
      const { launchChopsticksEffectProgram } = await import("../index.js");

      // This will fail because the endpoint doesn't exist, but we're testing error handling
      const program = launchChopsticksEffectProgram({
        endpoint: "wss://nonexistent.invalid",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      }).pipe(
        Effect.catchTag("ChopsticksSetupError", (error) =>
          Effect.succeed({ caught: true, endpoint: error.endpoint })
        )
      );

      // The program type shows it can fail with ChopsticksSetupError
      // We don't actually run this to avoid network calls
      expect(typeof program.pipe).toBe("function");
    });
  });

  describe("Return Value Structure", () => {
    it("should return object with result and cleanup when successful", () => {
      // This is a structural test - we verify the expected return type
      type LaunchResult = Awaited<ReturnType<typeof import("../index.js").launchChopsticksEffect>>;

      // Type assertion to verify structure
      const mockReturn: LaunchResult = {
        result: {
          chain: {} as any,
          addr: "127.0.0.1:8000",
          port: 8000,
          createBlock: () => Effect.succeed({ block: { hash: "0x" as const, number: 1 } }),
          setStorage: () => Effect.void,
          submitExtrinsic: () => Effect.succeed("0x" as `0x${string}`),
          dryRunExtrinsic: () => Effect.succeed({ success: true, storageDiff: [] }),
          getBlock: () => Effect.succeed(undefined),
          setHead: () => Effect.void,
          submitUpwardMessages: () => Effect.void,
          submitDownwardMessages: () => Effect.void,
          submitHorizontalMessages: () => Effect.void,
        },
        cleanup: async () => {},
      };

      expect(mockReturn.result).toBeDefined();
      expect(mockReturn.cleanup).toBeDefined();
      expect(typeof mockReturn.cleanup).toBe("function");
    });
  });
});

// =============================================================================
// Phase 3 Tests: Layer.scoped Version
// =============================================================================

describe("ChopsticksServiceLayer - Phase 3: Layer.scoped", () => {
  describe("Module Exports", () => {
    it("should export ChopsticksServiceLayer function", async () => {
      const module = await import("../index.js");
      expect(module.ChopsticksServiceLayer).toBeDefined();
      expect(typeof module.ChopsticksServiceLayer).toBe("function");
    });

    it("should export ChopsticksServiceLive Layer", async () => {
      const module = await import("../index.js");
      expect(module.ChopsticksServiceLive).toBeDefined();
    });
  });

  describe("ChopsticksServiceLayer Type", () => {
    it("should return a Layer when called with config", async () => {
      const { ChopsticksServiceLayer } = await import("../index.js");

      const layer = ChopsticksServiceLayer({
        endpoint: "wss://test.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      });

      // Verify it's a Layer by checking it has Layer-like structure
      expect(layer).toBeDefined();
    });

    it("should create Layer that provides ChopsticksService", async () => {
      const { ChopsticksServiceLayer } = await import("../index.js");
      const { ChopsticksService } = await import("../index.js");

      // Create a Layer
      const layer = ChopsticksServiceLayer({
        endpoint: "wss://test.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      });

      // Verify the Layer is typed to provide ChopsticksService
      // This is a compile-time check
      const program = Effect.gen(function* () {
        const service = yield* ChopsticksService;
        return service.addr;
      });

      // The program should be providable with the layer (compile-time check)
      const providedProgram = program.pipe(Effect.provide(layer));
      expect(typeof providedProgram.pipe).toBe("function");
    });

    it("should accept all config options using kebab-case", async () => {
      const { ChopsticksServiceLayer } = await import("../index.js");
      const { BuildBlockMode } = await import("@acala-network/chopsticks");

      const layer = ChopsticksServiceLayer({
        endpoint: "wss://rpc.polkadot.io",
        block: 12345,
        port: 9000,
        host: "0.0.0.0",
        "build-block-mode": BuildBlockMode.Manual,
        "wasm-override": "/path/to/wasm",
        "allow-unresolved-imports": true,
        "mock-signature-host": true,
        db: "./chopsticks.db",
        "runtime-log-level": 3,
        "rpc-timeout": 30000,
      });

      expect(layer).toBeDefined();
    });
  });

  describe("ChopsticksServiceLive Type", () => {
    it("should require ChopsticksConfigTag in context", async () => {
      const { ChopsticksServiceLive } = await import("../index.js");
      const { ChopsticksService, ChopsticksConfigTag } = await import("../index.js");

      // ChopsticksServiceLive requires ChopsticksConfigTag
      // This is verified by creating a program that uses both
      const configLayer = Layer.succeed(ChopsticksConfigTag, {
        endpoint: "wss://test.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      });

      const program = Effect.gen(function* () {
        const service = yield* ChopsticksService;
        return service.addr;
      });

      // Compose the layers - ChopsticksServiceLive needs ChopsticksConfigTag
      const fullLayer = ChopsticksServiceLive.pipe(Layer.provide(configLayer));

      // The program should be providable with the composed layer
      const providedProgram = program.pipe(Effect.provide(fullLayer));
      expect(typeof providedProgram.pipe).toBe("function");
    });

    it("should allow Layer composition patterns", async () => {
      const { ChopsticksServiceLive } = await import("../index.js");
      const { ChopsticksConfigTag } = await import("../index.js");

      // Create config layer
      const configLayer = Layer.succeed(ChopsticksConfigTag, {
        endpoint: "wss://test.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      });

      // Compose with ChopsticksServiceLive
      const serviceLayer = ChopsticksServiceLive.pipe(Layer.provide(configLayer));

      expect(serviceLayer).toBeDefined();
    });
  });

  describe("Layer Error Handling", () => {
    it("should produce ChopsticksSetupError on failure via ChopsticksServiceLayer", async () => {
      const { ChopsticksServiceLayer } = await import("../index.js");
      const { ChopsticksService } = await import("../index.js");

      const layer = ChopsticksServiceLayer({
        endpoint: "wss://nonexistent.invalid",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      });

      const program = Effect.gen(function* () {
        const service = yield* ChopsticksService;
        return service.addr;
      }).pipe(
        Effect.provide(layer),
        Effect.catchTag("ChopsticksSetupError", (error) =>
          Effect.succeed({ caught: true, endpoint: error.endpoint })
        )
      );

      // The program type shows it can fail with ChopsticksSetupError
      // We don't actually run this to avoid network calls
      expect(typeof program.pipe).toBe("function");
    });

    it("should produce ChopsticksSetupError on failure via ChopsticksServiceLive", async () => {
      const { ChopsticksServiceLive } = await import("../index.js");
      const { ChopsticksService, ChopsticksConfigTag } = await import("../index.js");

      const configLayer = Layer.succeed(ChopsticksConfigTag, {
        endpoint: "wss://nonexistent.invalid",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      });

      const fullLayer = ChopsticksServiceLive.pipe(Layer.provide(configLayer));

      const program = Effect.gen(function* () {
        const service = yield* ChopsticksService;
        return service.addr;
      }).pipe(
        Effect.provide(fullLayer),
        Effect.catchTag("ChopsticksSetupError", (error) =>
          Effect.succeed({ caught: true, endpoint: error.endpoint })
        )
      );

      expect(typeof program.pipe).toBe("function");
    });
  });

  describe("Scope Management", () => {
    it("should be usable with Effect.scoped for manual scope control", async () => {
      const { ChopsticksServiceLayer } = await import("../index.js");
      const { ChopsticksService } = await import("../index.js");

      const layer = ChopsticksServiceLayer({
        endpoint: "wss://test.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      });

      // Effect.scoped can be used to manually control the scope
      const program = Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ChopsticksService;
          return service.addr;
        }).pipe(Effect.provide(layer))
      );

      expect(typeof program.pipe).toBe("function");
    });
  });
});

// =============================================================================
// Integration Tests (marked with skip - require actual network)
// =============================================================================

describe.skip("launchChopsticksEffect - Integration Tests", () => {
  // These tests require a real network connection and would be run in CI
  // with appropriate network fixtures or against a local test node

  it("should launch chopsticks and return a working service", async () => {
    const { launchChopsticksEffect } = await import("../index.js");

    const { result, cleanup } = await launchChopsticksEffect({
      endpoint: "wss://rpc.polkadot.io",
      port: 8000,
      "build-block-mode": BuildBlockMode.Manual,
    });

    try {
      expect(result.addr).toMatch(/127\.0\.0\.1:\d+/);
      expect(result.port).toBe(8000);
      expect(result.chain).toBeDefined();
    } finally {
      await cleanup();
    }
  });

  it("should allow creating blocks after launch", async () => {
    const { launchChopsticksEffect } = await import("../index.js");

    const { result, cleanup } = await launchChopsticksEffect({
      endpoint: "wss://rpc.polkadot.io",
      port: 8001,
      "build-block-mode": BuildBlockMode.Manual,
    });

    try {
      const blockResult = await Effect.runPromise(result.createBlock());
      expect(blockResult.block.number).toBeGreaterThan(0);
      expect(blockResult.block.hash).toMatch(/^0x/);
    } finally {
      await cleanup();
    }
  });
});
