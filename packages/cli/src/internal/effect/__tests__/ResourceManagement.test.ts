import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Effect, Exit, Ref, Scope } from "effect";

// Import the module under test
import {
  withAcquireRelease,
  withEnsuredCleanup,
  useResource,
  withProcess,
  withProviders,
  withFoundation,
  combineCleanups,
  isCleanupError,
  type ManagedResource,
  type AcquireOptions,
} from "../ResourceManagement.js";

describe("ResourceManagement", () => {
  describe("withAcquireRelease", () => {
    it("should acquire and release resource on success", async () => {
      const cleanupCalled = { value: false };

      const acquire: Effect.Effect<ManagedResource<string, never>> = Effect.succeed({
        resource: "test-resource",
        cleanup: Effect.sync(() => {
          cleanupCalled.value = true;
        }),
      });

      const program = Effect.scoped(
        Effect.gen(function* () {
          const managed = yield* withAcquireRelease(acquire, (m) => m.cleanup, {
            resourceName: "test",
          });
          expect(managed.resource).toBe("test-resource");
          return managed.resource;
        })
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe("test-resource");
      expect(cleanupCalled.value).toBe(true);
    });

    it("should cleanup on failure", async () => {
      const cleanupCalled = { value: false };

      const acquire: Effect.Effect<ManagedResource<string, never>> = Effect.succeed({
        resource: "test-resource",
        cleanup: Effect.sync(() => {
          cleanupCalled.value = true;
        }),
      });

      const program = Effect.scoped(
        Effect.gen(function* () {
          yield* withAcquireRelease(acquire, (m) => m.cleanup, { resourceName: "test" });
          return yield* Effect.fail(new Error("Test failure"));
        })
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      expect(cleanupCalled.value).toBe(true);
    });

    it("should suppress cleanup errors when configured", async () => {
      const acquire: Effect.Effect<ManagedResource<string, Error>> = Effect.succeed({
        resource: "test-resource",
        cleanup: Effect.fail(new Error("Cleanup failed")),
      });

      const program = Effect.scoped(
        Effect.gen(function* () {
          const managed = yield* withAcquireRelease(acquire, (m) => m.cleanup, {
            resourceName: "test",
            suppressCleanupErrors: true,
          });
          return managed.resource;
        })
      );

      // Should not fail despite cleanup error
      const result = await Effect.runPromise(program);
      expect(result).toBe("test-resource");
    });

    it("should handle cleanup errors gracefully", async () => {
      const acquire: Effect.Effect<ManagedResource<string, Error>> = Effect.succeed({
        resource: "test-resource",
        cleanup: Effect.fail(new Error("Cleanup failed")),
      });

      const program = Effect.scoped(
        Effect.gen(function* () {
          const managed = yield* withAcquireRelease(acquire, (m) => m.cleanup, {
            resourceName: "test",
          });
          return managed.resource;
        })
      );

      // Should not fail - cleanup errors are logged but not propagated
      const result = await Effect.runPromise(program);
      expect(result).toBe("test-resource");
    });
  });

  describe("withEnsuredCleanup", () => {
    it("should run cleanup after successful effect", async () => {
      const cleanupCalled = { value: false };
      const cleanup = Effect.sync(() => {
        cleanupCalled.value = true;
      });

      const program = withEnsuredCleanup(Effect.succeed("result"), cleanup, {
        resourceName: "test",
      });

      const result = await Effect.runPromise(program);
      expect(result).toBe("result");
      expect(cleanupCalled.value).toBe(true);
    });

    it("should run cleanup after failed effect", async () => {
      const cleanupCalled = { value: false };
      const cleanup = Effect.sync(() => {
        cleanupCalled.value = true;
      });

      const program = withEnsuredCleanup(Effect.fail(new Error("Test error")), cleanup, {
        resourceName: "test",
      });

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      expect(cleanupCalled.value).toBe(true);
    });

    it("should suppress cleanup errors when configured", async () => {
      const cleanup = Effect.fail(new Error("Cleanup failed"));

      const program = withEnsuredCleanup(Effect.succeed("result"), cleanup, {
        resourceName: "test",
        suppressCleanupErrors: true,
      });

      // Should not fail despite cleanup error
      const result = await Effect.runPromise(program);
      expect(result).toBe("result");
    });
  });

  describe("useResource", () => {
    it("should acquire, use, and release resource", async () => {
      const events: string[] = [];

      const acquire: Effect.Effect<ManagedResource<string, never>> = Effect.sync(() => {
        events.push("acquired");
        return {
          resource: "test-resource",
          cleanup: Effect.sync(() => {
            events.push("released");
          }),
        };
      });

      const program = useResource(
        acquire,
        (managed) =>
          Effect.sync(() => {
            events.push(`used: ${managed.resource}`);
            return managed.resource.toUpperCase();
          }),
        { resourceName: "test" }
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe("TEST-RESOURCE");
      expect(events).toEqual(["acquired", "used: test-resource", "released"]);
    });

    it("should release on error during use", async () => {
      const events: string[] = [];

      const acquire: Effect.Effect<ManagedResource<string, never>> = Effect.sync(() => {
        events.push("acquired");
        return {
          resource: "test-resource",
          cleanup: Effect.sync(() => {
            events.push("released");
          }),
        };
      });

      const program = useResource(acquire, (_managed) => Effect.fail(new Error("Use failed")), {
        resourceName: "test",
      });

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      expect(events).toEqual(["acquired", "released"]);
    });
  });

  describe("withProcess", () => {
    it("should spawn process and cleanup on completion", async () => {
      const cleanupCalled = { value: false };

      const spawnEffect = Effect.succeed({
        result: { pid: 12345, port: 9944 },
        cleanup: Effect.sync(() => {
          cleanupCalled.value = true;
        }),
      });

      const program = withProcess(
        spawnEffect,
        (processInfo) => Effect.succeed(`Process ${processInfo.pid} on port ${processInfo.port}`),
        { processName: "test-process" }
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe("Process 12345 on port 9944");
      expect(cleanupCalled.value).toBe(true);
    });

    it("should cleanup process on error", async () => {
      const cleanupCalled = { value: false };

      const spawnEffect = Effect.succeed({
        result: { pid: 12345 },
        cleanup: Effect.sync(() => {
          cleanupCalled.value = true;
        }),
      });

      const program = withProcess(
        spawnEffect,
        (_processInfo) => Effect.fail(new Error("Process usage failed")),
        { processName: "test-process" }
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      expect(cleanupCalled.value).toBe(true);
    });
  });

  describe("withProviders", () => {
    it("should connect and disconnect providers", async () => {
      const disconnectCalled = { value: false };

      const connectEffect = Effect.succeed({
        info: { connectedCount: 2, endpoints: ["ws://localhost:9944", "http://localhost:8545"] },
        disconnect: Effect.sync(() => {
          disconnectCalled.value = true;
        }),
      });

      const program = withProviders(
        connectEffect,
        (info) => Effect.succeed(`Connected ${info.connectedCount} providers`),
        { connectionName: "test-providers" }
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe("Connected 2 providers");
      expect(disconnectCalled.value).toBe(true);
    });

    it("should disconnect providers on error", async () => {
      const disconnectCalled = { value: false };

      const connectEffect = Effect.succeed({
        info: { connectedCount: 2 },
        disconnect: Effect.sync(() => {
          disconnectCalled.value = true;
        }),
      });

      const program = withProviders(
        connectEffect,
        (_info) => Effect.fail(new Error("Provider operation failed")),
        { connectionName: "test-providers" }
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      expect(disconnectCalled.value).toBe(true);
    });
  });

  describe("withFoundation", () => {
    it("should start and stop foundation", async () => {
      const stopCalled = { value: false };

      const startEffect = Effect.succeed({
        info: { rpcPort: 9944, pid: 12345 },
        stop: Effect.sync(() => {
          stopCalled.value = true;
        }),
      });

      const program = withFoundation(
        startEffect,
        (info) => Effect.succeed(`Foundation on port ${info.rpcPort}`),
        { foundationName: "test-foundation" }
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe("Foundation on port 9944");
      expect(stopCalled.value).toBe(true);
    });

    it("should stop foundation on test failure", async () => {
      const stopCalled = { value: false };

      const startEffect = Effect.succeed({
        info: { rpcPort: 9944 },
        stop: Effect.sync(() => {
          stopCalled.value = true;
        }),
      });

      const program = withFoundation(
        startEffect,
        (_info) => Effect.fail(new Error("Test failed")),
        { foundationName: "test-foundation" }
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      expect(stopCalled.value).toBe(true);
    });

    it("should handle foundation start failure", async () => {
      const stopCalled = { value: false };

      const startEffect = Effect.fail(new Error("Foundation start failed"));

      const program = withFoundation(
        startEffect,
        (_info) => Effect.succeed("should not reach here"),
        { foundationName: "test-foundation" }
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      expect(stopCalled.value).toBe(false); // Stop not called because start failed
    });
  });

  describe("combineCleanups", () => {
    it("should run all cleanups in parallel", async () => {
      const cleanupOrder: string[] = [];
      const cleanups = [
        {
          name: "resource-1",
          cleanup: Effect.sync(() => {
            cleanupOrder.push("1");
          }),
        },
        {
          name: "resource-2",
          cleanup: Effect.sync(() => {
            cleanupOrder.push("2");
          }),
        },
        {
          name: "resource-3",
          cleanup: Effect.sync(() => {
            cleanupOrder.push("3");
          }),
        },
      ];

      await Effect.runPromise(combineCleanups(cleanups));

      // All should be cleaned up (order may vary due to parallel execution)
      expect(cleanupOrder.sort()).toEqual(["1", "2", "3"]);
    });

    it("should continue cleanup even if some fail", async () => {
      const cleanedUp: string[] = [];
      const cleanups = [
        {
          name: "success-1",
          cleanup: Effect.sync(() => {
            cleanedUp.push("success-1");
          }),
        },
        {
          name: "failure",
          cleanup: Effect.fail(new Error("Cleanup failed")),
        },
        {
          name: "success-2",
          cleanup: Effect.sync(() => {
            cleanedUp.push("success-2");
          }),
        },
      ];

      // Should not throw despite one failing
      await Effect.runPromise(combineCleanups(cleanups));

      // Successful cleanups should still run
      expect(cleanedUp.sort()).toEqual(["success-1", "success-2"]);
    });

    it("should handle empty cleanup list", async () => {
      await Effect.runPromise(combineCleanups([]));
      // Should complete without error
    });
  });

  describe("isCleanupError", () => {
    it("should return true for cleanup errors", () => {
      const error = {
        _tag: "CleanupError" as const,
        resourceName: "test",
        cause: new Error("Original error"),
      };
      expect(isCleanupError(error)).toBe(true);
    });

    it("should return false for non-cleanup errors", () => {
      expect(isCleanupError(new Error("Regular error"))).toBe(false);
      expect(isCleanupError({ _tag: "OtherError" })).toBe(false);
      expect(isCleanupError(null)).toBe(false);
      expect(isCleanupError(undefined)).toBe(false);
      expect(isCleanupError("string error")).toBe(false);
    });
  });

  describe("Integration: nested resource management", () => {
    it("should cleanup nested resources in correct order", async () => {
      const events: string[] = [];

      const program = Effect.scoped(
        Effect.gen(function* () {
          // Outer resource (foundation)
          const foundation = yield* withAcquireRelease(
            Effect.sync(() => {
              events.push("foundation-acquired");
              return {
                resource: { port: 9944 },
                cleanup: Effect.sync(() => {
                  events.push("foundation-released");
                }),
              };
            }),
            (m) => m.cleanup,
            { resourceName: "foundation" }
          );

          // Inner resource (providers)
          const providers = yield* withAcquireRelease(
            Effect.sync(() => {
              events.push("providers-acquired");
              return {
                resource: { count: 2 },
                cleanup: Effect.sync(() => {
                  events.push("providers-released");
                }),
              };
            }),
            (m) => m.cleanup,
            { resourceName: "providers" }
          );

          events.push(`using foundation port ${foundation.resource.port}`);
          events.push(`using ${providers.resource.count} providers`);

          return "done";
        })
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe("done");

      // Resources should be released in reverse order of acquisition
      expect(events).toEqual([
        "foundation-acquired",
        "providers-acquired",
        "using foundation port 9944",
        "using 2 providers",
        "providers-released",
        "foundation-released",
      ]);
    });

    it("should cleanup all acquired resources on partial failure", async () => {
      const events: string[] = [];

      const program = Effect.scoped(
        Effect.gen(function* () {
          // First resource - succeeds
          yield* withAcquireRelease(
            Effect.sync(() => {
              events.push("resource-1-acquired");
              return {
                resource: "r1",
                cleanup: Effect.sync(() => {
                  events.push("resource-1-released");
                }),
              };
            }),
            (m) => m.cleanup,
            { resourceName: "resource-1" }
          );

          // Second resource - succeeds
          yield* withAcquireRelease(
            Effect.sync(() => {
              events.push("resource-2-acquired");
              return {
                resource: "r2",
                cleanup: Effect.sync(() => {
                  events.push("resource-2-released");
                }),
              };
            }),
            (m) => m.cleanup,
            { resourceName: "resource-2" }
          );

          // Fail after acquiring both
          events.push("about-to-fail");
          return yield* Effect.fail(new Error("Operation failed"));
        })
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);

      // Both resources should be released even though operation failed
      expect(events).toEqual([
        "resource-1-acquired",
        "resource-2-acquired",
        "about-to-fail",
        "resource-2-released",
        "resource-1-released",
      ]);
    });
  });
});
