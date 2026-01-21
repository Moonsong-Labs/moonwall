import { describe, it, expect } from "bun:test";
import { Effect, Exit, Layer } from "effect";

// Import service interfaces
import {
  ReadOnlyFoundationService,
  type ReadOnlyFoundationConfig,
  type ReadOnlyFoundationRunningInfo,
  type ReadOnlyFoundationStatus,
} from "../../services/ReadOnlyFoundationService.js";
import {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
  ProviderConnectionError,
} from "../../errors/foundation.js";
import type { ReadOnlyLaunchSpec, ProviderConfig } from "@moonwall/types";

/**
 * Create a mock ReadOnlyLaunchSpec for testing.
 */
const createMockLaunchSpec = (): ReadOnlyLaunchSpec => ({
  name: "test-readonly-spec",
  rateLimiter: {
    minTime: 50,
    maxConcurrent: 10,
  },
});

/**
 * Create a mock ProviderConfig for testing.
 */
const createMockProviderConfig = (
  name = "polkadot",
  type: ProviderConfig["type"] = "polkadotJs"
): ProviderConfig => ({
  name,
  type,
  endpoints: [`wss://rpc.${name}.io`],
});

/**
 * Create a test config for the ReadOnlyFoundationService.
 */
const createTestConfig = (
  overrides?: Partial<ReadOnlyFoundationConfig>
): ReadOnlyFoundationConfig => ({
  name: "test-readonly",
  launchSpec: createMockLaunchSpec(),
  connections: [createMockProviderConfig()],
  ...overrides,
});

/**
 * Create a mock ReadOnlyFoundationService for testing.
 *
 * Since ReadOnlyFoundationService uses ProviderFactory internally
 * (which requires actual network connections), we mock the entire service
 * interface using Layer.succeed rather than mocking lower-level dependencies.
 */
const createMockReadOnlyFoundationService = (options?: {
  connectShouldFail?: boolean;
  connectFailureMessage?: string;
  connectFailureType?: "startup" | "provider";
  healthCheckShouldFail?: boolean;
  disconnectShouldFail?: boolean;
}) => {
  let status: ReadOnlyFoundationStatus = { _tag: "Disconnected" };
  let runningInfo: ReadOnlyFoundationRunningInfo | null = null;
  let cleanupCalled = false;

  const mockService = {
    connect: (config: ReadOnlyFoundationConfig) => {
      if (options?.connectShouldFail) {
        status = {
          _tag: "Failed",
          error: new Error(options.connectFailureMessage || "Mock failure"),
        };

        if (options.connectFailureType === "provider") {
          return Effect.fail(
            new ProviderConnectionError({
              providerType: "polkadotJs",
              endpoint: config.connections[0]?.endpoints[0] || "unknown",
              message: options.connectFailureMessage || "Mock provider failure",
            })
          );
        }

        return Effect.fail(
          new FoundationStartupError({
            foundationType: "read_only",
            message: options.connectFailureMessage || "Mock failure",
          })
        );
      }

      const endpoints = config.connections.map((c) => c.endpoints[0]);
      status = {
        _tag: "Connected",
        connectedProviders: config.connections.length,
        endpoints,
      };

      runningInfo = {
        connectedProviders: config.connections.length,
        endpoints,
        config,
      };

      const disconnectEffect = Effect.gen(function* () {
        if (options?.disconnectShouldFail) {
          return yield* Effect.fail(
            new FoundationShutdownError({
              foundationType: "read_only",
              message: "Mock disconnect failure",
              failedResources: ["mock-provider"],
            })
          );
        }
        cleanupCalled = true;
        status = { _tag: "Disconnected" };
        runningInfo = null;
      });

      return Effect.succeed({
        info: runningInfo,
        disconnect: disconnectEffect as Effect.Effect<void, FoundationShutdownError>,
      });
    },

    disconnect: () => {
      if (status._tag !== "Connected") {
        return Effect.void;
      }

      if (options?.disconnectShouldFail) {
        return Effect.fail(
          new FoundationShutdownError({
            foundationType: "read_only",
            message: "Mock disconnect failure",
            failedResources: ["mock-provider"],
          })
        );
      }

      cleanupCalled = true;
      status = { _tag: "Disconnected" };
      runningInfo = null;
      return Effect.void;
    },

    getStatus: () => Effect.succeed(status),

    healthCheck: (endpoint?: string) => {
      if (status._tag !== "Connected") {
        return Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "read_only",
            message: `Cannot health check: foundation is not connected (status: ${status._tag})`,
          })
        );
      }

      if (options?.healthCheckShouldFail) {
        return Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "read_only",
            message: "Mock health check failure",
            endpoint,
          })
        );
      }

      return Effect.void;
    },

    // Test helpers
    _isCleanupCalled: () => cleanupCalled,
    _resetCleanup: () => {
      cleanupCalled = false;
    },
  };

  return mockService;
};

/**
 * Create a Layer that provides a mock ReadOnlyFoundationService.
 */
const createMockLayer = (options?: Parameters<typeof createMockReadOnlyFoundationService>[0]) =>
  Layer.succeed(ReadOnlyFoundationService, createMockReadOnlyFoundationService(options));

describe("ReadOnlyFoundationService", () => {
  describe("connect", () => {
    it("should connect successfully with valid config", async () => {
      const mockLayer = createMockLayer();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        const { info, disconnect } = yield* readOnly.connect(config);

        expect(info.connectedProviders).toBe(1);
        expect(info.endpoints).toContain("wss://rpc.polkadot.io");
        expect(info.config).toBe(config);

        // Cleanup
        yield* disconnect;
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
    });

    it("should connect with multiple providers", async () => {
      const mockLayer = createMockLayer();
      const config = createTestConfig({
        connections: [
          createMockProviderConfig("polkadot", "polkadotJs"),
          createMockProviderConfig("moonbeam", "ethers"),
          createMockProviderConfig("moonbeam-viem", "viem"),
        ],
      });

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        const { info, disconnect } = yield* readOnly.connect(config);

        expect(info.connectedProviders).toBe(3);
        expect(info.endpoints).toHaveLength(3);

        yield* disconnect;
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
    });

    it("should fail with FoundationStartupError when connection fails", async () => {
      const mockLayer = createMockLayer({
        connectShouldFail: true,
        connectFailureMessage: "Network unreachable",
      });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        yield* readOnly.connect(config);
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(mockLayer)));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe("Fail");
        if (error._tag === "Fail") {
          expect(error.error._tag).toBe("FoundationStartupError");
          expect((error.error as FoundationStartupError).message).toContain("Network unreachable");
        }
      }
    });

    it("should fail with ProviderConnectionError when provider connection fails", async () => {
      const mockLayer = createMockLayer({
        connectShouldFail: true,
        connectFailureType: "provider",
        connectFailureMessage: "WebSocket connection refused",
      });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        yield* readOnly.connect(config);
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(mockLayer)));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe("Fail");
        if (error._tag === "Fail") {
          expect(error.error._tag).toBe("ProviderConnectionError");
          expect((error.error as ProviderConnectionError).providerType).toBe("polkadotJs");
        }
      }
    });
  });

  describe("disconnect", () => {
    it("should disconnect successfully when connected", async () => {
      const mockService = createMockReadOnlyFoundationService();
      const mockLayer = Layer.succeed(ReadOnlyFoundationService, mockService);
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;

        // Connect first
        yield* readOnly.connect(config);

        // Then disconnect
        yield* readOnly.disconnect();

        // Verify disconnected
        const status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Disconnected");
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
      expect(mockService._isCleanupCalled()).toBe(true);
    });

    it("should do nothing when not connected", async () => {
      const mockLayer = createMockLayer();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;

        // Disconnect without connecting
        yield* readOnly.disconnect();

        // Should still be disconnected
        const status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Disconnected");
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
    });

    it("should fail when disconnect fails", async () => {
      const mockLayer = createMockLayer({ disconnectShouldFail: true });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        const { disconnect } = yield* readOnly.connect(config);
        yield* disconnect;
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(mockLayer)));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe("Fail");
        if (error._tag === "Fail") {
          expect(error.error._tag).toBe("FoundationShutdownError");
        }
      }
    });
  });

  describe("getStatus", () => {
    it("should return Disconnected when not connected", async () => {
      const mockLayer = createMockLayer();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        const status = yield* readOnly.getStatus();

        expect(status._tag).toBe("Disconnected");
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
    });

    it("should return Connected when connected", async () => {
      const mockLayer = createMockLayer();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        const { disconnect } = yield* readOnly.connect(config);

        const status = yield* readOnly.getStatus();

        expect(status._tag).toBe("Connected");
        if (status._tag === "Connected") {
          expect(status.connectedProviders).toBe(1);
          expect(status.endpoints).toContain("wss://rpc.polkadot.io");
        }

        yield* disconnect;
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
    });

    it("should return Failed when connection failed", async () => {
      const mockLayer = createMockLayer({
        connectShouldFail: true,
        connectFailureMessage: "Connection timeout",
      });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;

        // Try to connect (will fail)
        yield* readOnly.connect(config).pipe(Effect.ignore);

        const status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Failed");
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
    });
  });

  describe("healthCheck", () => {
    it("should pass health check when connected", async () => {
      const mockLayer = createMockLayer();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        const { disconnect } = yield* readOnly.connect(config);

        // Health check should succeed
        yield* readOnly.healthCheck();

        yield* disconnect;
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
    });

    it("should fail health check when not connected", async () => {
      const mockLayer = createMockLayer();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        yield* readOnly.healthCheck();
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(mockLayer)));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe("Fail");
        if (error._tag === "Fail") {
          expect(error.error._tag).toBe("FoundationHealthCheckError");
          expect((error.error as FoundationHealthCheckError).message).toContain("not connected");
        }
      }
    });

    it("should fail health check when provider is unresponsive", async () => {
      const mockLayer = createMockLayer({ healthCheckShouldFail: true });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        const { disconnect } = yield* readOnly.connect(config);

        yield* readOnly.healthCheck();

        yield* disconnect;
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(mockLayer)));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe("Fail");
        if (error._tag === "Fail") {
          expect(error.error._tag).toBe("FoundationHealthCheckError");
        }
      }
    });

    it("should accept optional endpoint parameter", async () => {
      const mockLayer = createMockLayer();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;
        const { disconnect } = yield* readOnly.connect(config);

        // Health check with specific endpoint
        yield* readOnly.healthCheck("wss://rpc.polkadot.io");

        yield* disconnect;
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
    });
  });

  describe("lifecycle integration", () => {
    it("should support connect -> healthCheck -> disconnect lifecycle", async () => {
      const mockService = createMockReadOnlyFoundationService();
      const mockLayer = Layer.succeed(ReadOnlyFoundationService, mockService);
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;

        // 1. Initial state should be Disconnected
        let status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Disconnected");

        // 2. Connect
        const { info, disconnect } = yield* readOnly.connect(config);
        expect(info.connectedProviders).toBe(1);

        // 3. Should be Connected
        status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Connected");

        // 4. Health check should pass
        yield* readOnly.healthCheck();

        // 5. Disconnect via returned effect
        yield* disconnect;

        // 6. Should be Disconnected again
        status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Disconnected");
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
      expect(mockService._isCleanupCalled()).toBe(true);
    });

    it("should support multiple connect/disconnect cycles", async () => {
      const mockService = createMockReadOnlyFoundationService();
      const mockLayer = Layer.succeed(ReadOnlyFoundationService, mockService);
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const readOnly = yield* ReadOnlyFoundationService;

        // First cycle
        const { disconnect: disconnect1 } = yield* readOnly.connect(config);
        let status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Connected");

        yield* disconnect1;
        status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Disconnected");

        mockService._resetCleanup();

        // Second cycle
        const { disconnect: disconnect2 } = yield* readOnly.connect(config);
        status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Connected");

        yield* disconnect2;
        status = yield* readOnly.getStatus();
        expect(status._tag).toBe("Disconnected");
      });

      await Effect.runPromise(program.pipe(Effect.provide(mockLayer)));
    });
  });
});
