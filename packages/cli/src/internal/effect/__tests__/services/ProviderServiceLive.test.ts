import { describe, it, expect, mock, } from "bun:test";
import { Effect, Exit, Layer } from "effect";

// Import service interfaces and Live implementation
import {
  ProviderService,
  ProviderServiceLive,
  makeProviderServiceLayer,
  ProviderDisconnectError,
  ProviderHealthCheckError,
  type ProviderServiceConfig,
} from "../../services/index.js";
import { ProviderConnectionError } from "../../errors/foundation.js";
import type { ConnectedProvider, ProviderConfig } from "@moonwall/types";

/**
 * Create a mock connected provider for testing.
 */
const createMockConnectedProvider = (
  name: string,
  type: "polkadotJs" | "ethers" | "viem" | "web3" | "papi" = "polkadotJs"
): ConnectedProvider => ({
  name,
  type,
  api: {} as ConnectedProvider["api"],
  disconnect: mock(() => Promise.resolve()),
  greet: mock(() => Promise.resolve({ rtName: "test-chain", rtVersion: 1 })),
});

/**
 * Create test provider configs.
 */
const createTestProviderConfig = (
  name: string,
  type: "polkadotJs" | "ethers" | "viem" | "web3" | "papi" = "polkadotJs"
): ProviderConfig => ({
  name,
  type,
  endpoints: [`wss://test-${name}.example.com`],
});

/**
 * Create a test ProviderServiceConfig.
 */
const createTestConfig = (overrides?: Partial<ProviderServiceConfig>): ProviderServiceConfig => ({
  providers: [
    createTestProviderConfig("polkadot", "polkadotJs"),
    createTestProviderConfig("ethereum", "ethers"),
  ],
  connectionTimeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  ...overrides,
});

describe("ProviderServiceLive", () => {
  /**
   * Note: These tests use Layer.succeed to mock the ProviderService interface
   * rather than testing the real ProviderServiceLive, because the Live implementation
   * requires actual network connections via ProviderFactory and ProviderInterfaceFactory.
   *
   * For true integration testing of ProviderServiceLive, you would need a running
   * blockchain node endpoint.
   */

  describe("connect() with mock service", () => {
    it("should connect providers and return running info with disconnect effect", async () => {
      const mockProviders = [
        createMockConnectedProvider("polkadot", "polkadotJs"),
        createMockConnectedProvider("ethereum", "ethers"),
      ];

      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(2),
        connect: (config) =>
          Effect.succeed({
            info: {
              connectedProviders: mockProviders,
              connectedCount: mockProviders.length,
              endpoints: ["wss://test-polkadot.example.com", "https://test-ethereum.example.com"],
              config,
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () =>
          Effect.succeed({
            _tag: "Connected" as const,
            connectedCount: 2,
            endpoints: ["wss://test-polkadot.example.com", "https://test-ethereum.example.com"],
          }),
        getProvider: (name) => Effect.succeed(mockProviders.find((p) => p.name === name)),
        getAllProviders: () => Effect.succeed(mockProviders),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const { info, disconnect } = yield* providerService.connect(config);

        expect(info.connectedCount).toBe(2);
        expect(info.connectedProviders).toHaveLength(2);
        expect(info.endpoints).toContain("wss://test-polkadot.example.com");
        expect(info.config).toBe(config);

        // Verify disconnect effect works
        yield* disconnect;
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockProviderService)));

      expect(Exit.isSuccess(result)).toBe(true);
    });

    it("should fail with ProviderConnectionError when connection fails", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.fail(
            new ProviderConnectionError({
              providerType: "polkadotJs",
              endpoint: "wss://test-polkadot.example.com",
              message: "Connection timeout",
            })
          ),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Failed" as const, error: "Connection failed" }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.connect(config);
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockProviderService)));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe("Fail");
      }
    });

    it("should handle empty providers config", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.fail(
            new ProviderConnectionError({
              providerType: "polkadotJs",
              endpoint: "",
              message: "No providers configured",
            })
          ),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Idle" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const config = createTestConfig({ providers: [] });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.connect(config);
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockProviderService)));

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe("disconnect() with mock service", () => {
    it("should disconnect all providers", async () => {
      let disconnectCalled = false;

      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () =>
          Effect.sync(() => {
            disconnectCalled = true;
          }),
        getStatus: () => Effect.succeed({ _tag: "Disconnected" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.disconnect();
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));

      expect(disconnectCalled).toBe(true);
    });

    it("should fail with ProviderDisconnectError when disconnect fails", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () =>
          Effect.fail(
            new ProviderDisconnectError({
              providerName: "polkadot",
              providerType: "polkadotJs",
              message: "Failed to close WebSocket connection",
            })
          ),
        getStatus: () => Effect.succeed({ _tag: "Failed" as const, error: "Disconnect failed" }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.disconnect();
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockProviderService)));

      expect(Exit.isFailure(result)).toBe(true);
    });

    it("should handle disconnect when no providers connected", async () => {
      let disconnectCalled = false;

      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () =>
          Effect.sync(() => {
            disconnectCalled = true;
          }),
        getStatus: () => Effect.succeed({ _tag: "Idle" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.disconnect();
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockProviderService)));

      expect(Exit.isSuccess(result)).toBe(true);
      expect(disconnectCalled).toBe(true);
    });
  });

  describe("getStatus() with mock service", () => {
    it("should return Idle status when not connected", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Idle" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const status = yield* providerService.getStatus();
        expect(status._tag).toBe("Idle");
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });

    it("should return Connected status with provider info", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(2),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 2,
              endpoints: ["wss://test.example.com"],
              config: createTestConfig(),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () =>
          Effect.succeed({
            _tag: "Connected" as const,
            connectedCount: 2,
            endpoints: ["wss://test.example.com", "https://eth.example.com"],
          }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const status = yield* providerService.getStatus();
        expect(status._tag).toBe("Connected");
        if (status._tag === "Connected") {
          expect(status.connectedCount).toBe(2);
          expect(status.endpoints).toHaveLength(2);
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });

    it("should return Connecting status with progress", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(3),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig(),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () =>
          Effect.succeed({
            _tag: "Connecting" as const,
            totalProviders: 3,
            connectedCount: 1,
          }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const status = yield* providerService.getStatus();
        expect(status._tag).toBe("Connecting");
        if (status._tag === "Connecting") {
          expect(status.totalProviders).toBe(3);
          expect(status.connectedCount).toBe(1);
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });

    it("should return Disconnected status after disconnect", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Disconnected" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const status = yield* providerService.getStatus();
        expect(status._tag).toBe("Disconnected");
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });

    it("should return Failed status when error occurred", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () =>
          Effect.succeed({ _tag: "Failed" as const, error: new Error("Connection failed") }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const status = yield* providerService.getStatus();
        expect(status._tag).toBe("Failed");
        if (status._tag === "Failed") {
          expect(status.error).toBeDefined();
        }
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });
  });

  describe("getProvider() with mock service", () => {
    it("should return provider by name", async () => {
      const mockProvider = createMockConnectedProvider("polkadot", "polkadotJs");

      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(1),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [mockProvider],
              connectedCount: 1,
              endpoints: ["wss://test.example.com"],
              config: createTestConfig(),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () =>
          Effect.succeed({ _tag: "Connected" as const, connectedCount: 1, endpoints: [] }),
        getProvider: (name) => Effect.succeed(name === "polkadot" ? mockProvider : undefined),
        getAllProviders: () => Effect.succeed([mockProvider]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const provider = yield* providerService.getProvider("polkadot");

        expect(provider).toBeDefined();
        expect(provider?.name).toBe("polkadot");
        expect(provider?.type).toBe("polkadotJs");
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });

    it("should return undefined for non-existent provider", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Idle" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const provider = yield* providerService.getProvider("nonexistent");

        expect(provider).toBeUndefined();
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });
  });

  describe("getAllProviders() with mock service", () => {
    it("should return all connected providers", async () => {
      const mockProviders = [
        createMockConnectedProvider("polkadot", "polkadotJs"),
        createMockConnectedProvider("ethereum", "ethers"),
        createMockConnectedProvider("moonbeam", "viem"),
      ];

      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(3),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: mockProviders,
              connectedCount: 3,
              endpoints: [],
              config: createTestConfig(),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () =>
          Effect.succeed({ _tag: "Connected" as const, connectedCount: 3, endpoints: [] }),
        getProvider: (name) => Effect.succeed(mockProviders.find((p) => p.name === name)),
        getAllProviders: () => Effect.succeed(mockProviders),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const providers = yield* providerService.getAllProviders();

        expect(providers).toHaveLength(3);
        expect(providers.map((p) => p.name)).toEqual(["polkadot", "ethereum", "moonbeam"]);
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });

    it("should return empty array when no providers", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Idle" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const providers = yield* providerService.getAllProviders();

        expect(providers).toHaveLength(0);
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });
  });

  describe("healthCheck() with mock service", () => {
    it("should succeed when all providers are healthy", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(2),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 2,
              endpoints: [],
              config: createTestConfig(),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () =>
          Effect.succeed({ _tag: "Connected" as const, connectedCount: 2, endpoints: [] }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.healthCheck();
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockProviderService)));

      expect(Exit.isSuccess(result)).toBe(true);
    });

    it("should fail with ProviderHealthCheckError when provider unhealthy", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(2),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 2,
              endpoints: [],
              config: createTestConfig(),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () =>
          Effect.succeed({ _tag: "Connected" as const, connectedCount: 2, endpoints: [] }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () =>
          Effect.fail(
            new ProviderHealthCheckError({
              providerName: "polkadot",
              providerType: "polkadotJs",
              endpoint: "wss://test.example.com",
              message: "Provider not responding",
            })
          ),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.healthCheck();
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockProviderService)));

      expect(Exit.isFailure(result)).toBe(true);
    });

    it("should fail when not connected", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Idle" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () =>
          Effect.fail(
            new ProviderHealthCheckError({
              providerName: "all",
              providerType: "polkadotJs",
              endpoint: "",
              message: "Cannot health check: service is not connected",
            })
          ),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.healthCheck();
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockProviderService)));

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe("healthCheckProvider() with mock service", () => {
    it("should check health of a specific provider", async () => {
      let checkedProvider = "";

      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(2),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 2,
              endpoints: [],
              config: createTestConfig(),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () =>
          Effect.succeed({ _tag: "Connected" as const, connectedCount: 2, endpoints: [] }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: (name) =>
          Effect.sync(() => {
            checkedProvider = name;
          }),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.healthCheckProvider("ethereum");
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));

      expect(checkedProvider).toBe("ethereum");
    });

    it("should fail when provider not found", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () => Effect.succeed(0),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Idle" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: (name) =>
          Effect.fail(
            new ProviderHealthCheckError({
              providerName: name,
              providerType: "polkadotJs",
              endpoint: "",
              message: `Provider "${name}" not found`,
            })
          ),
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        yield* providerService.healthCheckProvider("nonexistent");
      });

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(MockProviderService)));

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe("createProviders() with mock service", () => {
    it("should create lazy providers from config", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: (config) => Effect.succeed(config.providers.length),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Idle" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const config = createTestConfig({
        providers: [
          createTestProviderConfig("polkadot", "polkadotJs"),
          createTestProviderConfig("ethereum", "ethers"),
          createTestProviderConfig("moonbeam", "viem"),
        ],
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const count = yield* providerService.createProviders(config);
        expect(count).toBe(3);
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });

    it("should handle empty config", async () => {
      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: (config) => Effect.succeed(config.providers.length),
        connect: () =>
          Effect.succeed({
            info: {
              connectedProviders: [],
              connectedCount: 0,
              endpoints: [],
              config: createTestConfig({ providers: [] }),
            },
            disconnect: Effect.succeed(undefined),
          }),
        disconnect: () => Effect.succeed(undefined),
        getStatus: () => Effect.succeed({ _tag: "Idle" as const }),
        getProvider: () => Effect.succeed(undefined),
        getAllProviders: () => Effect.succeed([]),
        healthCheck: () => Effect.succeed(undefined),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const config = createTestConfig({ providers: [] });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;
        const count = yield* providerService.createProviders(config);
        expect(count).toBe(0);
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));
    });
  });

  describe("lifecycle integration with mock service", () => {
    it("should handle full lifecycle: connect -> use -> disconnect", async () => {
      const lifecycleEvents: string[] = [];
      const mockProviders = [createMockConnectedProvider("polkadot", "polkadotJs")];

      const MockProviderService = Layer.succeed(ProviderService, {
        createProviders: () =>
          Effect.sync(() => {
            lifecycleEvents.push("createProviders");
            return 1;
          }),
        connect: (config) =>
          Effect.gen(function* () {
            lifecycleEvents.push("connect");
            return {
              info: {
                connectedProviders: mockProviders,
                connectedCount: 1,
                endpoints: ["wss://test.example.com"],
                config,
              },
              disconnect: Effect.sync(() => {
                lifecycleEvents.push("disconnect (via effect)");
              }),
            };
          }),
        disconnect: () =>
          Effect.sync(() => {
            lifecycleEvents.push("disconnect");
          }),
        getStatus: () =>
          Effect.succeed({ _tag: "Connected" as const, connectedCount: 1, endpoints: [] }),
        getProvider: (name) => Effect.succeed(mockProviders.find((p) => p.name === name)),
        getAllProviders: () => Effect.succeed(mockProviders),
        healthCheck: () =>
          Effect.sync(() => {
            lifecycleEvents.push("healthCheck");
          }),
        healthCheckProvider: () => Effect.succeed(undefined),
      });

      const config = createTestConfig({
        providers: [createTestProviderConfig("polkadot", "polkadotJs")],
      });

      const program = Effect.gen(function* () {
        const providerService = yield* ProviderService;

        // Connect
        const { info, disconnect } = yield* providerService.connect(config);
        expect(info.connectedCount).toBe(1);

        // Use
        const provider = yield* providerService.getProvider("polkadot");
        expect(provider).toBeDefined();

        yield* providerService.healthCheck();

        // Disconnect
        yield* disconnect;
      });

      await Effect.runPromise(program.pipe(Effect.provide(MockProviderService)));

      expect(lifecycleEvents).toContain("connect");
      expect(lifecycleEvents).toContain("healthCheck");
      expect(lifecycleEvents).toContain("disconnect (via effect)");
    });
  });
});

describe("ProviderServiceLive Layer export", () => {
  it("should export ProviderServiceLive Layer", () => {
    expect(ProviderServiceLive).toBeDefined();
  });

  it("should export makeProviderServiceLayer factory", () => {
    expect(makeProviderServiceLayer).toBeDefined();
    expect(typeof makeProviderServiceLayer).toBe("function");
  });

  it("makeProviderServiceLayer should return a Layer", () => {
    const layer = makeProviderServiceLayer();
    expect(layer).toBeDefined();
  });
});
