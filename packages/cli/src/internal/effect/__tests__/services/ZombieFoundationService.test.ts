import { describe, it, expect } from "bun:test";
import { Effect, Exit, Layer } from "effect";

// Import service interfaces
import {
  ZombieFoundationService,
  ZombieNodeOperationError,
  type ZombieFoundationConfig,
  type ZombieNodeInfo,
} from "../../services/ZombieFoundationService.js";
import {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
} from "../../errors/foundation.js";
import type { ZombieLaunchSpec } from "@moonwall/types";

/**
 * Create a mock ZombieLaunchSpec for testing.
 */
const createMockLaunchSpec = (): ZombieLaunchSpec => ({
  name: "test-zombie",
  configPath: "./zombienet.json",
});

/**
 * Create a test config for the ZombieFoundationService.
 */
const createTestConfig = (overrides?: Partial<ZombieFoundationConfig>): ZombieFoundationConfig => ({
  configPath: "./zombienet.json",
  name: "test-zombie-network",
  launchSpec: createMockLaunchSpec(),
  ...overrides,
});

/**
 * Create a mock ZombieFoundationService for testing.
 *
 * Since ZombieFoundationService uses @zombienet/orchestrator internally
 * (which requires actual binaries and network operations), we mock the entire
 * service interface using Layer.succeed rather than mocking lower-level dependencies.
 */
const createMockZombieFoundationService = (options?: {
  startShouldFail?: boolean;
  startFailureMessage?: string;
  healthCheckShouldFail?: boolean;
  restartNodeShouldFail?: boolean;
  killNodeShouldFail?: boolean;
  mockNodes?: ReadonlyArray<ZombieNodeInfo>;
}) => {
  let status: {
    _tag: string;
    relayWsEndpoint?: string;
    paraWsEndpoint?: string;
    nodeCount?: number;
    error?: unknown;
  } = { _tag: "Stopped" };
  let cleanupCalled = false;

  const defaultNodes: ReadonlyArray<ZombieNodeInfo> = options?.mockNodes ?? [
    {
      name: "alice",
      type: "relaychain",
      wsEndpoint: "ws://127.0.0.1:9944",
      multiAddress: "/ip4/127.0.0.1/tcp/30333/p2p/12D3...",
    },
    {
      name: "bob",
      type: "relaychain",
      wsEndpoint: "ws://127.0.0.1:9945",
      multiAddress: "/ip4/127.0.0.1/tcp/30334/p2p/12D3...",
    },
    {
      name: "collator01",
      type: "parachain",
      wsEndpoint: "ws://127.0.0.1:9946",
      multiAddress: "/ip4/127.0.0.1/tcp/30335/p2p/12D3...",
      parachainId: 1000,
    },
  ];

  const mockService = {
    start: (config: ZombieFoundationConfig) => {
      if (options?.startShouldFail) {
        status = {
          _tag: "Failed",
          error: new Error(options.startFailureMessage || "Mock failure"),
        };
        return Effect.fail(
          new FoundationStartupError({
            foundationType: "zombie",
            message: options.startFailureMessage || "Mock failure",
          })
        );
      }

      const relayWsEndpoint = "ws://127.0.0.1:9944";
      const paraWsEndpoint = "ws://127.0.0.1:9946";
      status = {
        _tag: "Running",
        relayWsEndpoint,
        paraWsEndpoint,
        nodeCount: defaultNodes.length,
      };

      const stopEffect = Effect.gen(function* () {
        cleanupCalled = true;
        status = { _tag: "Stopped" };
      });

      return Effect.succeed({
        info: {
          relayWsEndpoint,
          paraWsEndpoint,
          tempDir: "/tmp/zombienet-12345",
          nodes: defaultNodes,
          config,
        },
        stop: stopEffect as Effect.Effect<void, FoundationShutdownError>,
      });
    },

    stop: () =>
      Effect.gen(function* () {
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
            foundationType: "zombie",
            message: "Cannot health check: foundation is not running",
          })
        );
      }
      if (options?.healthCheckShouldFail) {
        return Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "zombie",
            message: "Health check failed",
            endpoint: status.relayWsEndpoint,
          })
        );
      }
      return Effect.void;
    },

    getNodes: () => {
      if (status._tag !== "Running") {
        return Effect.succeed([] as ReadonlyArray<ZombieNodeInfo>);
      }
      return Effect.succeed(defaultNodes);
    },

    restartNode: (nodeName: string) => {
      if (status._tag !== "Running") {
        return Effect.fail(
          new ZombieNodeOperationError(
            "restart",
            nodeName,
            "Cannot restart node: network is not running"
          )
        );
      }
      if (options?.restartNodeShouldFail) {
        return Effect.fail(
          new ZombieNodeOperationError("restart", nodeName, "Failed to restart node")
        );
      }
      // Check if node exists
      const nodeExists = defaultNodes.some((n) => n.name === nodeName);
      if (!nodeExists) {
        return Effect.fail(
          new ZombieNodeOperationError("restart", nodeName, `Node '${nodeName}' not found`)
        );
      }
      return Effect.void;
    },

    killNode: (nodeName: string) => {
      if (status._tag !== "Running") {
        return Effect.fail(
          new ZombieNodeOperationError("kill", nodeName, "Cannot kill node: network is not running")
        );
      }
      if (options?.killNodeShouldFail) {
        return Effect.fail(new ZombieNodeOperationError("kill", nodeName, "Failed to kill node"));
      }
      // Check if node exists
      const nodeExists = defaultNodes.some((n) => n.name === nodeName);
      if (!nodeExists) {
        return Effect.fail(
          new ZombieNodeOperationError("kill", nodeName, `Node '${nodeName}' not found`)
        );
      }
      return Effect.void;
    },

    // Helper for tests to check cleanup state
    wasCleanupCalled: () => cleanupCalled,
  };

  return {
    layer: Layer.succeed(ZombieFoundationService, mockService),
    getMockState: () => ({ status, cleanupCalled }),
  };
};

describe("ZombieFoundationService", () => {
  describe("start()", () => {
    it("should start zombie network and return running info with stop effect", async () => {
      const { layer, getMockState } = createMockZombieFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;
        const { info, stop } = yield* zombie.start(config);

        // Verify running info
        expect(info.relayWsEndpoint).toBe("ws://127.0.0.1:9944");
        expect(info.paraWsEndpoint).toBe("ws://127.0.0.1:9946");
        expect(info.tempDir).toBe("/tmp/zombienet-12345");
        expect(info.nodes.length).toBe(3);
        expect(info.config).toBe(config);

        // Verify status is Running
        const status = yield* zombie.getStatus();
        expect(status._tag).toBe("Running");
        if (status._tag === "Running") {
          expect(status.relayWsEndpoint).toBe("ws://127.0.0.1:9944");
          expect(status.nodeCount).toBe(3);
        }

        // Stop the network
        yield* stop;

        // Verify cleanup was called
        expect(getMockState().cleanupCalled).toBe(true);

        // Verify status is now Stopped
        const finalStatus = yield* zombie.getStatus();
        expect(finalStatus._tag).toBe("Stopped");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail with FoundationStartupError when network launch fails", async () => {
      const { layer } = createMockZombieFoundationService({
        startShouldFail: true,
        startFailureMessage: "Binary 'polkadot' not found",
      });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;
        yield* zombie.start(config);
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationStartupError);
        if (error instanceof FoundationStartupError) {
          expect(error.foundationType).toBe("zombie");
          expect(error.message).toContain("polkadot");
        }
      }
    });
  });

  describe("stop()", () => {
    it("should stop a running zombie network via the service stop() method", async () => {
      const { layer, getMockState } = createMockZombieFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Start the network
        yield* zombie.start(config);

        // Verify it's running
        const runningStatus = yield* zombie.getStatus();
        expect(runningStatus._tag).toBe("Running");

        // Stop via service method (not the returned stop effect)
        yield* zombie.stop();

        // Verify cleanup was called
        expect(getMockState().cleanupCalled).toBe(true);

        // Verify status is Stopped
        const stoppedStatus = yield* zombie.getStatus();
        expect(stoppedStatus._tag).toBe("Stopped");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should not fail when stop() is called on a non-running service", async () => {
      const { layer } = createMockZombieFoundationService();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Try to stop without starting - should not fail
        yield* zombie.stop();

        // Verify status is still Stopped
        const status = yield* zombie.getStatus();
        expect(status._tag).toBe("Stopped");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe("getStatus()", () => {
    it("should return Stopped initially", async () => {
      const { layer } = createMockZombieFoundationService();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;
        const status = yield* zombie.getStatus();
        expect(status._tag).toBe("Stopped");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should return Running with node count after start", async () => {
      const { layer } = createMockZombieFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;
        yield* zombie.start(config);

        const status = yield* zombie.getStatus();
        expect(status._tag).toBe("Running");
        if (status._tag === "Running") {
          expect(status.nodeCount).toBe(3);
          expect(status.relayWsEndpoint).toBe("ws://127.0.0.1:9944");
          expect(status.paraWsEndpoint).toBe("ws://127.0.0.1:9946");
        }
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe("healthCheck()", () => {
    it("should pass health check for running zombie network", async () => {
      const { layer } = createMockZombieFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Start the network
        yield* zombie.start(config);

        // Health check should pass
        yield* zombie.healthCheck();
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail health check when network is not running", async () => {
      const { layer } = createMockZombieFoundationService();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Try health check without starting - should fail
        yield* zombie.healthCheck();
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationHealthCheckError);
        if (error instanceof FoundationHealthCheckError) {
          expect(error.foundationType).toBe("zombie");
          expect(error.message).toContain("not running");
        }
      }
    });

    it("should fail health check when relay node is unresponsive", async () => {
      const { layer } = createMockZombieFoundationService({
        healthCheckShouldFail: true,
      });
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Start the network
        yield* zombie.start(config);

        // Health check should fail
        yield* zombie.healthCheck();
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationHealthCheckError);
      }
    });
  });

  describe("getNodes()", () => {
    it("should return all nodes when network is running", async () => {
      const { layer } = createMockZombieFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Start the network
        yield* zombie.start(config);

        // Get nodes
        const nodes = yield* zombie.getNodes();
        expect(nodes.length).toBe(3);

        // Check relay nodes
        const relayNodes = nodes.filter((n) => n.type === "relaychain");
        expect(relayNodes.length).toBe(2);
        expect(relayNodes[0].name).toBe("alice");
        expect(relayNodes[1].name).toBe("bob");

        // Check parachain nodes
        const paraNodes = nodes.filter((n) => n.type === "parachain");
        expect(paraNodes.length).toBe(1);
        expect(paraNodes[0].name).toBe("collator01");
        expect(paraNodes[0].parachainId).toBe(1000);
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should return empty array when network is not running", async () => {
      const { layer } = createMockZombieFoundationService();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Get nodes without starting - should return empty
        const nodes = yield* zombie.getNodes();
        expect(nodes.length).toBe(0);
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe("restartNode()", () => {
    it("should restart a node when network is running", async () => {
      const { layer } = createMockZombieFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Start the network
        yield* zombie.start(config);

        // Restart alice
        yield* zombie.restartNode("alice");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail to restart node when network is not running", async () => {
      const { layer } = createMockZombieFoundationService();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Try to restart without starting network
        yield* zombie.restartNode("alice");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(ZombieNodeOperationError);
        if (error instanceof ZombieNodeOperationError) {
          expect(error.operation).toBe("restart");
          expect(error.nodeName).toBe("alice");
          expect(error.reason).toContain("not running");
        }
      }
    });

    it("should fail to restart non-existent node", async () => {
      const { layer } = createMockZombieFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Start the network
        yield* zombie.start(config);

        // Try to restart non-existent node
        yield* zombie.restartNode("nonexistent");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(ZombieNodeOperationError);
        if (error instanceof ZombieNodeOperationError) {
          expect(error.nodeName).toBe("nonexistent");
          expect(error.reason).toContain("not found");
        }
      }
    });
  });

  describe("killNode()", () => {
    it("should kill a node when network is running", async () => {
      const { layer } = createMockZombieFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Start the network
        yield* zombie.start(config);

        // Kill bob
        yield* zombie.killNode("bob");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail to kill node when network is not running", async () => {
      const { layer } = createMockZombieFoundationService();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Try to kill without starting network
        yield* zombie.killNode("bob");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(ZombieNodeOperationError);
        if (error instanceof ZombieNodeOperationError) {
          expect(error.operation).toBe("kill");
          expect(error.nodeName).toBe("bob");
          expect(error.reason).toContain("not running");
        }
      }
    });

    it("should fail to kill non-existent node", async () => {
      const { layer } = createMockZombieFoundationService();
      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const zombie = yield* ZombieFoundationService;

        // Start the network
        yield* zombie.start(config);

        // Try to kill non-existent node
        yield* zombie.killNode("nonexistent");
      }).pipe(Effect.provide(layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(ZombieNodeOperationError);
        if (error instanceof ZombieNodeOperationError) {
          expect(error.nodeName).toBe("nonexistent");
          expect(error.reason).toContain("not found");
        }
      }
    });
  });
});
