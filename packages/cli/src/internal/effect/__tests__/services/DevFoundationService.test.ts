import { describe, it, expect, mock } from "bun:test";
import { Effect, Exit, Layer } from "effect";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

// Import service interfaces
import {
  DevFoundationService,
  type DevFoundationConfig,
} from "../../services/DevFoundationService.js";
import { makeDevFoundationServiceLayer } from "../../services/DevFoundationServiceLive.js";
import { ProcessManagerService, type ProcessLaunchResult } from "../../ProcessManagerService.js";
import { RpcPortDiscoveryService } from "../../RpcPortDiscoveryService.js";
import { NodeReadinessService } from "../../NodeReadinessService.js";
import { NodeLaunchError, PortDiscoveryError } from "../../errors.js";
import { FoundationStartupError, FoundationHealthCheckError } from "../../errors/foundation.js";

/**
 * Create a mock child process for testing.
 */
const createMockProcess = (pid = 12345): ChildProcess => {
  const proc = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof mock>;
  };
  proc.pid = pid;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = mock((_signal?: string) => {
    setTimeout(() => proc.emit("close", 0, null), 10);
    return true;
  });
  return proc as unknown as ChildProcess;
};

/**
 * Create a test config for the DevFoundationService.
 */
const createTestConfig = (overrides?: Partial<DevFoundationConfig>): DevFoundationConfig => ({
  command: "./moonbeam",
  args: ["--dev", "--sealing=manual"],
  name: "test-node",
  launchSpec: {} as DevFoundationConfig["launchSpec"],
  isEthereumChain: true,
  ...overrides,
});

describe("DevFoundationService", () => {
  describe("start()", () => {
    it("should start a node and return running info with stop effect", async () => {
      const mockProcess = createMockProcess(12345);
      const mockPort = 9944;
      const mockLogPath = "/tmp/node_logs/moonbeam_node_9944_12345.log";
      const cleanupCalled = { value: false };

      // Create mock cleanup effect
      const mockCleanup = Effect.sync(() => {
        cleanupCalled.value = true;
      });

      // Create mock layers for dependencies
      const MockProcessManager = Layer.succeed(ProcessManagerService, {
        launch: () =>
          Effect.succeed({
            result: {
              process: mockProcess,
              logPath: mockLogPath,
            } satisfies ProcessLaunchResult,
            cleanup: mockCleanup,
          }),
      });

      const MockRpcDiscovery = Layer.succeed(RpcPortDiscoveryService, {
        discoverRpcPort: () => Effect.succeed(mockPort),
      });

      const MockNodeReadiness = Layer.succeed(NodeReadinessService, {
        checkReady: () => Effect.succeed(true),
      });

      const TestDependencies = Layer.mergeAll(
        MockProcessManager,
        MockRpcDiscovery,
        MockNodeReadiness
      );

      const TestDevFoundationService = makeDevFoundationServiceLayer(TestDependencies);

      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;
        const { info, stop } = yield* devFoundation.start(config);

        // Verify running info
        expect(info.process).toBe(mockProcess);
        expect(info.rpcPort).toBe(mockPort);
        expect(info.logPath).toBe(mockLogPath);
        expect(info.config).toBe(config);

        // Verify status is Running
        const status = yield* devFoundation.getStatus();
        expect(status._tag).toBe("Running");
        if (status._tag === "Running") {
          expect(status.rpcPort).toBe(mockPort);
          expect(status.pid).toBe(12345);
        }

        // Stop the node
        yield* stop;

        // Verify cleanup was called
        expect(cleanupCalled.value).toBe(true);

        // Verify status is now Stopped
        const finalStatus = yield* devFoundation.getStatus();
        expect(finalStatus._tag).toBe("Stopped");
      }).pipe(Effect.provide(TestDevFoundationService));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail with FoundationStartupError when process launch fails", async () => {
      const MockProcessManager = Layer.succeed(ProcessManagerService, {
        launch: () =>
          Effect.fail(
            new NodeLaunchError({
              cause: new Error("Command not found"),
              command: "./invalid-command",
              args: [],
            })
          ),
      });

      const MockRpcDiscovery = Layer.succeed(RpcPortDiscoveryService, {
        discoverRpcPort: () => Effect.succeed(9944),
      });

      const MockNodeReadiness = Layer.succeed(NodeReadinessService, {
        checkReady: () => Effect.succeed(true),
      });

      const TestDependencies = Layer.mergeAll(
        MockProcessManager,
        MockRpcDiscovery,
        MockNodeReadiness
      );

      const TestDevFoundationService = makeDevFoundationServiceLayer(TestDependencies);

      const config = createTestConfig({ command: "./invalid-command" });

      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;
        yield* devFoundation.start(config);
      }).pipe(Effect.provide(TestDevFoundationService));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationStartupError);
        if (error instanceof FoundationStartupError) {
          expect(error.foundationType).toBe("dev");
          expect(error.message).toContain("Failed to launch dev node");
        }
      }
    });

    it("should fail with FoundationStartupError when port discovery fails", async () => {
      const mockProcess = createMockProcess(12345);
      const cleanupCalled = { value: false };

      const MockProcessManager = Layer.succeed(ProcessManagerService, {
        launch: () =>
          Effect.succeed({
            result: {
              process: mockProcess,
              logPath: "/tmp/test.log",
            } satisfies ProcessLaunchResult,
            cleanup: Effect.sync(() => {
              cleanupCalled.value = true;
            }),
          }),
      });

      const MockRpcDiscovery = Layer.succeed(RpcPortDiscoveryService, {
        discoverRpcPort: () =>
          Effect.fail(
            new PortDiscoveryError({
              cause: new Error("Port discovery timeout"),
              pid: 12345,
              attempts: 600,
            })
          ),
      });

      const MockNodeReadiness = Layer.succeed(NodeReadinessService, {
        checkReady: () => Effect.succeed(true),
      });

      const TestDependencies = Layer.mergeAll(
        MockProcessManager,
        MockRpcDiscovery,
        MockNodeReadiness
      );

      const TestDevFoundationService = makeDevFoundationServiceLayer(TestDependencies);

      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;
        yield* devFoundation.start(config);
      }).pipe(Effect.provide(TestDevFoundationService));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationStartupError);
        if (error instanceof FoundationStartupError) {
          expect(error.foundationType).toBe("dev");
          expect(error.message).toContain("Failed to discover RPC port");
        }
      }
    });
  });

  describe("stop()", () => {
    it("should stop a running node via the service stop() method", async () => {
      const mockProcess = createMockProcess(12345);
      const cleanupCalled = { value: false };

      const MockProcessManager = Layer.succeed(ProcessManagerService, {
        launch: () =>
          Effect.succeed({
            result: {
              process: mockProcess,
              logPath: "/tmp/test.log",
            } satisfies ProcessLaunchResult,
            cleanup: Effect.sync(() => {
              cleanupCalled.value = true;
            }),
          }),
      });

      const MockRpcDiscovery = Layer.succeed(RpcPortDiscoveryService, {
        discoverRpcPort: () => Effect.succeed(9944),
      });

      const MockNodeReadiness = Layer.succeed(NodeReadinessService, {
        checkReady: () => Effect.succeed(true),
      });

      const TestDependencies = Layer.mergeAll(
        MockProcessManager,
        MockRpcDiscovery,
        MockNodeReadiness
      );

      const TestDevFoundationService = makeDevFoundationServiceLayer(TestDependencies);

      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;

        // Start the node
        yield* devFoundation.start(config);

        // Verify it's running
        const runningStatus = yield* devFoundation.getStatus();
        expect(runningStatus._tag).toBe("Running");

        // Stop via service method (not the returned stop effect)
        yield* devFoundation.stop();

        // Verify cleanup was called
        expect(cleanupCalled.value).toBe(true);

        // Verify status is Stopped
        const stoppedStatus = yield* devFoundation.getStatus();
        expect(stoppedStatus._tag).toBe("Stopped");
      }).pipe(Effect.provide(TestDevFoundationService));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should not fail when stop() is called on a non-running service", async () => {
      const MockProcessManager = Layer.succeed(ProcessManagerService, {
        launch: () =>
          Effect.succeed({
            result: {
              process: createMockProcess(),
              logPath: "/tmp/test.log",
            } satisfies ProcessLaunchResult,
            cleanup: Effect.void,
          }),
      });

      const MockRpcDiscovery = Layer.succeed(RpcPortDiscoveryService, {
        discoverRpcPort: () => Effect.succeed(9944),
      });

      const MockNodeReadiness = Layer.succeed(NodeReadinessService, {
        checkReady: () => Effect.succeed(true),
      });

      const TestDependencies = Layer.mergeAll(
        MockProcessManager,
        MockRpcDiscovery,
        MockNodeReadiness
      );

      const TestDevFoundationService = makeDevFoundationServiceLayer(TestDependencies);

      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;

        // Try to stop without starting - should not fail
        yield* devFoundation.stop();

        // Verify status is still Stopped
        const status = yield* devFoundation.getStatus();
        expect(status._tag).toBe("Stopped");
      }).pipe(Effect.provide(TestDevFoundationService));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe("getStatus()", () => {
    it("should return Stopped initially", async () => {
      const MockProcessManager = Layer.succeed(ProcessManagerService, {
        launch: () =>
          Effect.succeed({
            result: {
              process: createMockProcess(),
              logPath: "/tmp/test.log",
            } satisfies ProcessLaunchResult,
            cleanup: Effect.void,
          }),
      });

      const MockRpcDiscovery = Layer.succeed(RpcPortDiscoveryService, {
        discoverRpcPort: () => Effect.succeed(9944),
      });

      const MockNodeReadiness = Layer.succeed(NodeReadinessService, {
        checkReady: () => Effect.succeed(true),
      });

      const TestDependencies = Layer.mergeAll(
        MockProcessManager,
        MockRpcDiscovery,
        MockNodeReadiness
      );

      const TestDevFoundationService = makeDevFoundationServiceLayer(TestDependencies);

      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;
        const status = yield* devFoundation.getStatus();
        expect(status._tag).toBe("Stopped");
      }).pipe(Effect.provide(TestDevFoundationService));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe("healthCheck()", () => {
    it("should pass health check for running node", async () => {
      const mockProcess = createMockProcess(12345);

      const MockProcessManager = Layer.succeed(ProcessManagerService, {
        launch: () =>
          Effect.succeed({
            result: {
              process: mockProcess,
              logPath: "/tmp/test.log",
            } satisfies ProcessLaunchResult,
            cleanup: Effect.void,
          }),
      });

      const MockRpcDiscovery = Layer.succeed(RpcPortDiscoveryService, {
        discoverRpcPort: () => Effect.succeed(9944),
      });

      const MockNodeReadiness = Layer.succeed(NodeReadinessService, {
        checkReady: () => Effect.succeed(true),
      });

      const TestDependencies = Layer.mergeAll(
        MockProcessManager,
        MockRpcDiscovery,
        MockNodeReadiness
      );

      const TestDevFoundationService = makeDevFoundationServiceLayer(TestDependencies);

      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;

        // Start the node
        yield* devFoundation.start(config);

        // Health check should pass
        yield* devFoundation.healthCheck();
      }).pipe(Effect.provide(TestDevFoundationService));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail health check when node is not running", async () => {
      const MockProcessManager = Layer.succeed(ProcessManagerService, {
        launch: () =>
          Effect.succeed({
            result: {
              process: createMockProcess(),
              logPath: "/tmp/test.log",
            } satisfies ProcessLaunchResult,
            cleanup: Effect.void,
          }),
      });

      const MockRpcDiscovery = Layer.succeed(RpcPortDiscoveryService, {
        discoverRpcPort: () => Effect.succeed(9944),
      });

      const MockNodeReadiness = Layer.succeed(NodeReadinessService, {
        checkReady: () => Effect.succeed(true),
      });

      const TestDependencies = Layer.mergeAll(
        MockProcessManager,
        MockRpcDiscovery,
        MockNodeReadiness
      );

      const TestDevFoundationService = makeDevFoundationServiceLayer(TestDependencies);

      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;

        // Try health check without starting - should fail
        yield* devFoundation.healthCheck();
      }).pipe(Effect.provide(TestDevFoundationService));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationHealthCheckError);
        if (error instanceof FoundationHealthCheckError) {
          expect(error.foundationType).toBe("dev");
          expect(error.message).toContain("foundation is not running");
        }
      }
    });

    it("should fail health check when node readiness check fails", async () => {
      const mockProcess = createMockProcess(12345);

      const MockProcessManager = Layer.succeed(ProcessManagerService, {
        launch: () =>
          Effect.succeed({
            result: {
              process: mockProcess,
              logPath: "/tmp/test.log",
            } satisfies ProcessLaunchResult,
            cleanup: Effect.void,
          }),
      });

      const MockRpcDiscovery = Layer.succeed(RpcPortDiscoveryService, {
        discoverRpcPort: () => Effect.succeed(9944),
      });

      // Node readiness fails for health check
      let _callCount = 0;
      const MockNodeReadiness = Layer.succeed(NodeReadinessService, {
        checkReady: () => {
          _callCount++;
          // First call (during start) succeeds - actually start doesn't call checkReady
          // Only health check calls it, so we can fail it directly
          return Effect.succeed(false);
        },
      });

      const TestDependencies = Layer.mergeAll(
        MockProcessManager,
        MockRpcDiscovery,
        MockNodeReadiness
      );

      const TestDevFoundationService = makeDevFoundationServiceLayer(TestDependencies);

      const config = createTestConfig();

      const program = Effect.gen(function* () {
        const devFoundation = yield* DevFoundationService;

        // Start the node (doesn't call checkReady)
        yield* devFoundation.start(config);

        // Health check should fail
        yield* devFoundation.healthCheck();
      }).pipe(Effect.provide(TestDevFoundationService));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        const error = exit.cause.error;
        expect(error).toBeInstanceOf(FoundationHealthCheckError);
        if (error instanceof FoundationHealthCheckError) {
          expect(error.message).toContain("returned false");
        }
      }
    });
  });
});
