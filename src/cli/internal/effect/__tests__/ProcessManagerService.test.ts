import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { EventEmitter } from "node:events";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import {
  ProcessManagerService,
  Spawner,
  makeProcessManagerServiceTest,
  NodeLaunchError,
  type MoonwallProcess,
} from "../index.js";

/**
 * Create a mock MoonwallProcess (EventEmitter with pid, stdout, stderr, kill)
 */
const createMockProcess = (overrides?: {
  pid?: number;
  hasStdout?: boolean;
  hasStderr?: boolean;
}): MoonwallProcess => {
  const proc = new EventEmitter() as unknown as MoonwallProcess;
  Object.defineProperty(proc, "pid", { value: overrides?.pid ?? 12345, writable: true });

  if (overrides?.hasStdout !== false) {
    Object.defineProperty(proc, "stdout", { value: new EventEmitter(), writable: true });
  }
  if (overrides?.hasStderr !== false) {
    Object.defineProperty(proc, "stderr", { value: new EventEmitter(), writable: true });
  }

  const killFn = () => {
    setTimeout(() => proc.emit("close", 0, null), 10);
  };
  Object.defineProperty(proc, "kill", { value: killFn, writable: true });

  return proc;
};

/**
 * Create a mock Spawner layer with optional overrides
 */
const createMockSpawnerLayer = (overrides?: {
  spawn?: (
    command: string,
    args: ReadonlyArray<string>
  ) => Effect.Effect<MoonwallProcess, NodeLaunchError>;
}): Layer.Layer<Spawner> =>
  Layer.succeed(Spawner, {
    spawn: overrides?.spawn ?? ((_cmd, _args) => Effect.sync(() => createMockProcess())),
  });

/**
 * Create a unique temp directory for test isolation
 */
const makeTempDir = (): string => {
  const dir = path.join(
    os.tmpdir(),
    `moonwall-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

describe("ProcessManagerService", () => {
  it.effect("should launch a process and return cleanup function", () => {
    const tmpDir = makeTempDir();
    const config = {
      command: "node",
      args: ["-e", "console.log('hello')"],
      name: "test-process",
      logDirectory: tmpDir,
    };

    const testLayer = makeProcessManagerServiceTest(createMockSpawnerLayer());

    return ProcessManagerService.pipe(
      Effect.flatMap((service) =>
        service.launch(config).pipe(
          Effect.flatMap(({ result, cleanup }) =>
            Effect.sync(() => {
              expect(result.process.pid).toBeDefined();
              expect(result.process.pid).toBe(12345);
              expect(result.logPath).toContain(tmpDir);
            }).pipe(
              Effect.flatMap(() => cleanup),
              Effect.tap(() =>
                Effect.sync(() => {
                  // Process should have been marked as terminating by cleanup
                  expect(result.process.isMoonwallTerminating).toBe(true);
                  expect(result.process.moonwallTerminationReason).toBe("Manual cleanup requested");
                })
              )
            )
          )
        )
      ),
      Effect.provide(testLayer),
      Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
    );
  });

  it.effect("should handle process launch failure", () => {
    const failingSpawner = createMockSpawnerLayer({
      spawn: (command, _args) =>
        Effect.fail(
          new NodeLaunchError({
            cause: new Error("Mock spawn error"),
            command,
            args: [],
          })
        ),
    });
    const tmpDir = makeTempDir();
    const config = {
      command: "invalid-command",
      args: [],
      name: "fail-process",
      logDirectory: tmpDir,
    };

    const testLayer = makeProcessManagerServiceTest(failingSpawner);

    return ProcessManagerService.pipe(
      Effect.flatMap((service) => service.launch(config)),
      Effect.provide(testLayer),
      Effect.flip,
      Effect.map((error) => {
        expect(error).toBeInstanceOf(NodeLaunchError);
        if (error instanceof NodeLaunchError) {
          expect(error.command).toBe(config.command);
        }
      }),
      Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
    );
  });

  it.effect("should ensure log directory is created when it does not exist", () => {
    // Use a nested path that doesn't exist yet — real FileSystem will create it
    const tmpBase = makeTempDir();
    const nestedLogDir = path.join(tmpBase, "nested", "log", "dir");
    const config = {
      command: "node",
      args: ["-e", "console.log('hello')"],
      name: "test-process",
      logDirectory: nestedLogDir,
    };

    const testLayer = makeProcessManagerServiceTest(createMockSpawnerLayer());

    return ProcessManagerService.pipe(
      Effect.flatMap((service) => service.launch(config)),
      Effect.provide(testLayer),
      Effect.map(({ result }) => {
        // Verify the nested directory was created
        expect(fs.existsSync(nestedLogDir)).toBe(true);
        expect(result.logPath).toContain(nestedLogDir);
      }),
      Effect.ensuring(Effect.sync(() => fs.rmSync(tmpBase, { recursive: true, force: true })))
    );
  });
});
