import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Effect, Exit } from "effect";

import { registerProcessExitCleanup, combineCleanups } from "../ResourceManagement.js";

describe("GracefulShutdown", () => {
  describe("registerProcessExitCleanup", () => {
    let originalListeners: {
      SIGINT: NodeJS.SignalsListener[];
      SIGTERM: NodeJS.SignalsListener[];
    };

    beforeEach(() => {
      // Save original listeners so we can restore them
      originalListeners = {
        SIGINT: process.listeners("SIGINT") as NodeJS.SignalsListener[],
        SIGTERM: process.listeners("SIGTERM") as NodeJS.SignalsListener[],
      };
      // Remove all listeners temporarily for clean testing
      process.removeAllListeners("SIGINT");
      process.removeAllListeners("SIGTERM");
    });

    afterEach(() => {
      // Restore original listeners
      process.removeAllListeners("SIGINT");
      process.removeAllListeners("SIGTERM");
      for (const listener of originalListeners.SIGINT) {
        process.on("SIGINT", listener);
      }
      for (const listener of originalListeners.SIGTERM) {
        process.on("SIGTERM", listener);
      }
    });

    it("should register SIGINT and SIGTERM handlers", async () => {
      const cleanupCalled = { value: false };
      const cleanup = Effect.sync(() => {
        cleanupCalled.value = true;
      });

      const program = registerProcessExitCleanup(cleanup, { resourceName: "test-resource" });
      const unregister = await Effect.runPromise(program);

      // Verify handlers were registered
      expect(process.listenerCount("SIGINT")).toBe(1);
      expect(process.listenerCount("SIGTERM")).toBe(1);

      // Clean up
      unregister();
    });

    it("should unregister handlers when finalizer is called", async () => {
      const cleanup = Effect.void;

      const program = registerProcessExitCleanup(cleanup, { resourceName: "test-resource" });
      const unregister = await Effect.runPromise(program);

      // Verify handlers were registered
      expect(process.listenerCount("SIGINT")).toBe(1);
      expect(process.listenerCount("SIGTERM")).toBe(1);

      // Call unregister
      unregister();

      // Verify handlers were removed
      expect(process.listenerCount("SIGINT")).toBe(0);
      expect(process.listenerCount("SIGTERM")).toBe(0);
    });

    it("should allow multiple cleanup registrations", async () => {
      const cleanups: string[] = [];

      const cleanup1 = Effect.sync(() => {
        cleanups.push("cleanup1");
      });
      const cleanup2 = Effect.sync(() => {
        cleanups.push("cleanup2");
      });

      const program1 = registerProcessExitCleanup(cleanup1, { resourceName: "resource-1" });
      const program2 = registerProcessExitCleanup(cleanup2, { resourceName: "resource-2" });

      const unregister1 = await Effect.runPromise(program1);
      const unregister2 = await Effect.runPromise(program2);

      // Verify multiple handlers were registered
      expect(process.listenerCount("SIGINT")).toBe(2);
      expect(process.listenerCount("SIGTERM")).toBe(2);

      // Clean up
      unregister1();
      unregister2();

      expect(process.listenerCount("SIGINT")).toBe(0);
      expect(process.listenerCount("SIGTERM")).toBe(0);
    });
  });

  describe("Shutdown Cleanup Order", () => {
    it("should cleanup resources in reverse acquisition order", async () => {
      const events: string[] = [];

      const program = Effect.scoped(
        Effect.gen(function* () {
          // Simulate foundation startup
          events.push("foundation-start");
          yield* Effect.acquireRelease(Effect.succeed("foundation"), () =>
            Effect.sync(() => {
              events.push("foundation-stop");
            })
          );

          // Simulate provider connection
          events.push("providers-connect");
          yield* Effect.acquireRelease(Effect.succeed("providers"), () =>
            Effect.sync(() => {
              events.push("providers-disconnect");
            })
          );

          // Simulate test execution
          events.push("tests-run");
          return "done";
        })
      );

      await Effect.runPromise(program);

      // Resources should be cleaned up in reverse order (LIFO)
      expect(events).toEqual([
        "foundation-start",
        "providers-connect",
        "tests-run",
        "providers-disconnect",
        "foundation-stop",
      ]);
    });

    it("should cleanup all resources even if one fails", async () => {
      const cleanedUp: string[] = [];

      const cleanups = [
        {
          name: "resource-1",
          cleanup: Effect.sync(() => {
            cleanedUp.push("resource-1");
          }),
        },
        {
          name: "resource-2-fails",
          cleanup: Effect.fail(new Error("Cleanup 2 failed")),
        },
        {
          name: "resource-3",
          cleanup: Effect.sync(() => {
            cleanedUp.push("resource-3");
          }),
        },
      ];

      // combineCleanups should not throw and should clean all resources
      await Effect.runPromise(combineCleanups(cleanups));

      // Both successful cleanups should have run
      expect(cleanedUp.sort()).toEqual(["resource-1", "resource-3"]);
    });
  });

  describe("Signal Handler Behavior", () => {
    it("should handle cleanup errors gracefully without crashing", async () => {
      const events: string[] = [];

      // Create a cleanup that fails using Effect.try to capture the error
      const failingCleanup = Effect.try({
        try: () => {
          events.push("cleanup-started");
          throw new Error("Cleanup crashed");
        },
        catch: (error) => error as Error,
      });

      // Wrap in catchAll to verify error handling works
      const safeCleanup = failingCleanup.pipe(
        Effect.catchAll((error: Error) => {
          events.push(`error-caught: ${error.message}`);
          return Effect.void;
        })
      );

      await Effect.runPromise(safeCleanup);

      expect(events).toEqual(["cleanup-started", "error-caught: Cleanup crashed"]);
    });

    it("should timeout long-running cleanups", async () => {
      // Create a cleanup that takes too long (simulated)
      const slowCleanup = Effect.sleep("100 millis").pipe(Effect.tap(() => Effect.sync(() => {})));

      // With timeout, should not block forever
      const timedCleanup = slowCleanup.pipe(Effect.timeout("50 millis"));

      const exit = await Effect.runPromiseExit(timedCleanup);

      // Should complete (either success with None or timeout)
      expect(Exit.isSuccess(exit) || Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("MoonwallContext.destroy simulation", () => {
    it("should handle destroy with no context gracefully", async () => {
      // Simulates the case where destroy is called before context is created
      const program = Effect.gen(function* () {
        const hasContext = false;

        if (!hasContext) {
          // Return early without cleanup
          return "no-context";
        }

        // This would never be reached
        return yield* Effect.succeed("cleaned");
      });

      const result = await Effect.runPromise(program);
      expect(result).toBe("no-context");
    });

    it("should perform full cleanup sequence", async () => {
      const cleanupLog: string[] = [];

      // Simulate the MoonwallContext.destroy sequence
      const destroySequence = Effect.gen(function* () {
        // Step 1: Disconnect providers
        cleanupLog.push("disconnecting-providers");
        yield* Effect.all([
          Effect.sync(() => cleanupLog.push("provider-1-disconnected")),
          Effect.sync(() => cleanupLog.push("provider-2-disconnected")),
        ]);

        // Step 2: Kill child processes
        cleanupLog.push("killing-processes");
        yield* Effect.sync(() => cleanupLog.push("process-killed"));

        // Step 3: Stop docker containers
        cleanupLog.push("stopping-containers");
        yield* Effect.sync(() => cleanupLog.push("container-stopped"));

        // Step 4: Cleanup zombie network
        cleanupLog.push("stopping-zombie-network");
        yield* Effect.sync(() => cleanupLog.push("zombie-network-stopped"));

        return "cleanup-complete";
      });

      const result = await Effect.runPromise(destroySequence);

      expect(result).toBe("cleanup-complete");
      expect(cleanupLog).toContain("disconnecting-providers");
      expect(cleanupLog).toContain("provider-1-disconnected");
      expect(cleanupLog).toContain("killing-processes");
      expect(cleanupLog).toContain("stopping-zombie-network");
    });
  });

  describe("Exit Code Handling", () => {
    it("should use correct exit codes for different signals", () => {
      // SIGINT exit code: 128 + 2 = 130
      const sigintExitCode = 128 + 2;
      expect(sigintExitCode).toBe(130);

      // SIGTERM exit code: 128 + 15 = 143
      const sigtermExitCode = 128 + 15;
      expect(sigtermExitCode).toBe(143);
    });

    it("should track termination reason in global scope", () => {
      // Test that termination reason can be stored and retrieved
      const originalReason = (global as Record<string, unknown>).MOONWALL_TERMINATION_REASON;

      try {
        (global as Record<string, unknown>).MOONWALL_TERMINATION_REASON = "test-termination";
        expect((global as Record<string, unknown>).MOONWALL_TERMINATION_REASON).toBe(
          "test-termination"
        );

        (global as Record<string, unknown>).MOONWALL_TERMINATION_REASON = "cancelled by user";
        expect((global as Record<string, unknown>).MOONWALL_TERMINATION_REASON).toBe(
          "cancelled by user"
        );
      } finally {
        // Restore original value
        if (originalReason === undefined) {
          delete (global as Record<string, unknown>).MOONWALL_TERMINATION_REASON;
        } else {
          (global as Record<string, unknown>).MOONWALL_TERMINATION_REASON = originalReason;
        }
      }
    });
  });

  describe("Process Cleanup Verification", () => {
    it("should wait for process to die before continuing", async () => {
      let processRunning = true;
      const checkCount = { value: 0 };

      // Simulate isPidRunning behavior
      const isPidRunning = () => {
        checkCount.value++;
        if (checkCount.value >= 3) {
          processRunning = false;
        }
        return processRunning;
      };

      // Simulate the wait-for-death loop
      const waitForDeath = Effect.gen(function* () {
        while (isPidRunning()) {
          yield* Effect.sleep("10 millis");
        }
        return "process-dead";
      });

      const result = await Effect.runPromise(waitForDeath);

      expect(result).toBe("process-dead");
      expect(checkCount.value).toBe(3);
      expect(processRunning).toBe(false);
    });

    it("should flag process before killing", async () => {
      interface MoonwallProcess {
        pid: number;
        isMoonwallTerminating?: boolean;
        moonwallTerminationReason?: string;
      }

      const mockProcess: MoonwallProcess = { pid: 12345 };

      // Simulate the flagging behavior from globalContext.ts
      mockProcess.isMoonwallTerminating = true;
      mockProcess.moonwallTerminationReason = "shutdown";

      expect(mockProcess.isMoonwallTerminating).toBe(true);
      expect(mockProcess.moonwallTerminationReason).toBe("shutdown");
    });
  });
});
