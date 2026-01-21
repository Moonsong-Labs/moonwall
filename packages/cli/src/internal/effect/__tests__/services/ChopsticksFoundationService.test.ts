import { describe, it, expect, } from "bun:test";
import { Effect, Exit, Layer } from "effect";
import type { HexString } from "@polkadot/util/types";

// Import service interfaces
import {
  ChopsticksFoundationService,
  type ChopsticksFoundationConfig,
} from "../../services/ChopsticksFoundationService.js";
import {
  FoundationStartupError,
  type FoundationShutdownError,
  FoundationHealthCheckError,
} from "../../errors/foundation.js";
import {
  ChopsticksBlockError,
  ChopsticksStorageError,
  type BlockCreationResult,
} from "../../ChopsticksService.js";
import type { ChopsticksLaunchSpec } from "@moonwall/types";

/**
 * Create a mock ChopsticksLaunchSpec for testing.
 */
const createMockLaunchSpec = (): ChopsticksLaunchSpec => ({
  name: "test-chopsticks",
  configPath: "./moonbeam.yml",
  wsPort: 8000,
  buildBlockMode: "manual",
});

/**
 * Create a test config for the ChopsticksFoundationService.
 */
const createTestConfig = (
  overrides?: Partial<ChopsticksFoundationConfig>
): ChopsticksFoundationConfig => ({
  configPath: "./moonbeam.yml",
  name: "test-chopsticks",
  launchSpec: createMockLaunchSpec(),
  wsPort: 8000,
  buildBlockMode: "manual",
  ...overrides,
});

/**
 * Create a mock ChopsticksFoundationService for testing.
 *
 * Since ChopsticksFoundationService uses launchChopsticksFromSpec internally
 * (which requires actual network connections), we mock the entire service
 * interface using Layer.succeed rather than mocking lower-level dependencies.
 */
const createMockChopsticksFoundationService = (options?: {
  startShouldFail?: boolean;
  startFailureMessage?: string;
  healthCheckShouldFail?: boolean;
  createBlockShouldFail?: boolean;
  setStorageShouldFail?: boolean;
  getBlockResult?: { hash: HexString; number: number } | undefined;
}) => {
  let status: { _tag: string; wsPort?: number; endpoint?: string; error?: unknown } = {
    _tag: "Stopped",
  };
  let cleanupCalled = false;

  const mockService = {
    start: (config: ChopsticksFoundationConfig) => {
      if (options?.startShouldFail) {
        status = {
          _tag: "Failed",
          error: new Error(options.startFailureMessage || "Mock failure"),
        };
        return Effect.fail(
          new FoundationStartupError({
            foundationType: "chopsticks",
            message: options.startFailureMessage || "Mock failure",
          })
        );
      }

      const wsPort = config.wsPort || 8000;
      const endpoint = `ws://127.0.0.1:${wsPort}`;
      status = { _tag: "Running", wsPort, endpoint };

      const stopEffect = Effect.sync(() => {
        cleanupCalled = true;
        status = { _tag: "Stopped" };
      });

      return Effect.succeed({
        info: {
          wsPort,
          endpoint,
          logPath: "/tmp/chopsticks.log",
          config,
        },
        stop: stopEffect as Effect.Effect<void, FoundationShutdownError>,
      });
    },

    stop: () =>
      Effect.sync(() => {
        if (status._tag !== "Running") {
          return;
        }
        cleanupCalled = true;
        status = { _tag: "Stopped" };
      }),

    getStatus: () => Effect.succeed(status as any),

    healthCheck: () => {
      if (status._tag !== "Running") {
        return Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "chopsticks",
            message: "Cannot health check: foundation is not running",
          })
        );
      }
      if (options?.healthCheckShouldFail) {
        return Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "chopsticks",
            message: "Health check failed",
            endpoint: status.endpoint,
          })
        );
      }
      return Effect.void;
    },

    createBlock: (_params?: any) => {
      if (status._tag !== "Running") {
        return Effect.fail(
          new ChopsticksBlockError({
            cause: new Error("Cannot create block: chopsticks is not running"),
            operation: "newBlock",
          })
        );
      }
      if (options?.createBlockShouldFail) {
        return Effect.fail(
          new ChopsticksBlockError({
            cause: new Error("Block creation failed"),
            operation: "newBlock",
          })
        );
      }
      return Effect.succeed({
        block: {
          hash: "0x1234" as HexString,
          number: 100,
        },
      } satisfies BlockCreationResult);
    },

    setStorage: (params: { module: string; method: string; params: unknown[] }) => {
      if (status._tag !== "Running") {
        return Effect.fail(
          new ChopsticksStorageError({
            cause: new Error("Cannot set storage: chopsticks is not running"),
            module: params.module,
            method: params.method,
          })
        );
      }
      if (options?.setStorageShouldFail) {
        return Effect.fail(
          new ChopsticksStorageError({
            cause: new Error("Storage modification failed"),
            module: params.module,
            method: params.method,
          })
        );
      }
      return Effect.void;
    },

    getBlock: (hashOrNumber?: HexString | number) => {
      if (status._tag !== "Running") {
        return Effect.fail(
          new ChopsticksBlockError({
            cause: new Error("Cannot get block: chopsticks is not running"),
            operation: "getBlock",
            blockIdentifier: hashOrNumber,
          })
        );
      }
      return Effect.succeed(options?.getBlockResult ?? { hash: "0xabcd" as HexString, number: 50 });
    },

    setHead: (hashOrNumber: HexString | number) => {
      if (status._tag !== "Running") {
        return Effect.fail(
          new ChopsticksBlockError({
            cause: new Error("Cannot set head: chopsticks is not running"),
            operation: "setHead",
            blockIdentifier: hashOrNumber,
          })
        );
      }
      return Effect.void;
    },

    // Helper for tests to check cleanup state
    wasCleanupCalled: () => cleanupCalled,
  };

  return {
    layer: Layer.succeed(ChopsticksFoundationService, mockService),
    getMockState: () => ({ status, cleanupCalled }),
  };
};

describe("ChopsticksFoundationService", () => {
  describe("start()", () => {
    it("should start chopsticks and return running info with stop effect", async () => {
      const { layer, getMockState } = createMockChopsticksFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;
        const { info, stop } = yield* chopsticks.start(config);

        // Verify running info
        expect(info.wsPort).toBe(8000);
        expect(info.endpoint).toBe("ws://127.0.0.1:8000");
        expect(info.config).toBe(config);

        // Verify status is Running
        const status = yield* chopsticks.getStatus();
        expect(status._tag).toBe("Running");
        if (status._tag === "Running") {
          expect(status.wsPort).toBe(8000);
          expect(status.endpoint).toBe("ws://127.0.0.1:8000");
        }

        // Stop the instance
        yield* stop;

        // Verify cleanup was called
        expect(getMockState().cleanupCalled).toBe(true);

        // Verify status is now Stopped
        const finalStatus = yield* chopsticks.getStatus();
        expect(finalStatus._tag).toBe("Stopped");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail with FoundationStartupError when launch fails", async () => {
      const { layer } = createMockChopsticksFoundationService({
        startShouldFail: true,
        startFailureMessage: "Connection refused to RPC endpoint",
      });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;
        yield* chopsticks.start(config);
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationStartupError);
        if (error instanceof FoundationStartupError) {
          expect(error.foundationType).toBe("chopsticks");
          expect(error.message).toContain("Connection refused");
        }
      }
    });
  });

  describe("stop()", () => {
    it("should stop a running chopsticks instance via the service stop() method", async () => {
      const { layer, getMockState } = createMockChopsticksFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Start the instance
        yield* chopsticks.start(config);

        // Verify it's running
        const runningStatus = yield* chopsticks.getStatus();
        expect(runningStatus._tag).toBe("Running");

        // Stop via service method (not the returned stop effect)
        yield* chopsticks.stop();

        // Verify cleanup was called
        expect(getMockState().cleanupCalled).toBe(true);

        // Verify status is Stopped
        const stoppedStatus = yield* chopsticks.getStatus();
        expect(stoppedStatus._tag).toBe("Stopped");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should not fail when stop() is called on a non-running service", async () => {
      const { layer } = createMockChopsticksFoundationService();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Try to stop without starting - should not fail
        yield* chopsticks.stop();

        // Verify status is still Stopped
        const status = yield* chopsticks.getStatus();
        expect(status._tag).toBe("Stopped");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe("getStatus()", () => {
    it("should return Stopped initially", async () => {
      const { layer } = createMockChopsticksFoundationService();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;
        const status = yield* chopsticks.getStatus();
        expect(status._tag).toBe("Stopped");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe("healthCheck()", () => {
    it("should pass health check for running chopsticks instance", async () => {
      const { layer } = createMockChopsticksFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Start the instance
        yield* chopsticks.start(config);

        // Health check should pass
        yield* chopsticks.healthCheck();
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail health check when chopsticks is not running", async () => {
      const { layer } = createMockChopsticksFoundationService();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Try health check without starting - should fail
        yield* chopsticks.healthCheck();
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationHealthCheckError);
        if (error instanceof FoundationHealthCheckError) {
          expect(error.foundationType).toBe("chopsticks");
          expect(error.message).toContain("not running");
        }
      }
    });

    it("should fail health check when instance is unresponsive", async () => {
      const { layer } = createMockChopsticksFoundationService({
        healthCheckShouldFail: true,
      });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Start the instance
        yield* chopsticks.start(config);

        // Health check should fail
        yield* chopsticks.healthCheck();
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationHealthCheckError);
      }
    });
  });

  describe("createBlock()", () => {
    it("should create a block when chopsticks is running", async () => {
      const { layer } = createMockChopsticksFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Start the instance
        yield* chopsticks.start(config);

        // Create a block
        const result = yield* chopsticks.createBlock();
        expect(result.block.hash).toBe("0x1234");
        expect(result.block.number).toBe(100);
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail to create block when chopsticks is not running", async () => {
      const { layer } = createMockChopsticksFoundationService();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Try to create block without starting
        yield* chopsticks.createBlock();
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(ChopsticksBlockError);
        if (error instanceof ChopsticksBlockError) {
          expect(error.operation).toBe("newBlock");
        }
      }
    });
  });

  describe("setStorage()", () => {
    it("should set storage when chopsticks is running", async () => {
      const { layer } = createMockChopsticksFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Start the instance
        yield* chopsticks.start(config);

        // Set storage
        yield* chopsticks.setStorage({
          module: "System",
          method: "Account",
          params: [["0x1234", { data: { free: "1000000000000" } }]],
        });
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail to set storage when chopsticks is not running", async () => {
      const { layer } = createMockChopsticksFoundationService();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Try to set storage without starting
        yield* chopsticks.setStorage({
          module: "System",
          method: "Account",
          params: [],
        });
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(ChopsticksStorageError);
        if (error instanceof ChopsticksStorageError) {
          expect(error.module).toBe("System");
          expect(error.method).toBe("Account");
        }
      }
    });
  });

  describe("getBlock()", () => {
    it("should get block when chopsticks is running", async () => {
      const { layer } = createMockChopsticksFoundationService({
        getBlockResult: { hash: "0xdeadbeef" as HexString, number: 42 },
      });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Start the instance
        yield* chopsticks.start(config);

        // Get block
        const block = yield* chopsticks.getBlock();
        expect(block).toBeDefined();
        expect(block?.hash).toBe("0xdeadbeef");
        expect(block?.number).toBe(42);
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail to get block when chopsticks is not running", async () => {
      const { layer } = createMockChopsticksFoundationService();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Try to get block without starting
        yield* chopsticks.getBlock();
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(ChopsticksBlockError);
        if (error instanceof ChopsticksBlockError) {
          expect(error.operation).toBe("getBlock");
        }
      }
    });
  });

  describe("setHead()", () => {
    it("should set head when chopsticks is running", async () => {
      const { layer } = createMockChopsticksFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Start the instance
        yield* chopsticks.start(config);

        // Set head
        yield* chopsticks.setHead(10);
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail to set head when chopsticks is not running", async () => {
      const { layer } = createMockChopsticksFoundationService();

      const program = Effect.gen(function* () {
        const chopsticks = yield* ChopsticksFoundationService;

        // Try to set head without starting
        yield* chopsticks.setHead("0x1234" as HexString);
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(ChopsticksBlockError);
        if (error instanceof ChopsticksBlockError) {
          expect(error.operation).toBe("setHead");
          expect(error.blockIdentifier).toBe("0x1234");
        }
      }
    });
  });
});
