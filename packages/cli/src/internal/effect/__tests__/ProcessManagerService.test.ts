import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect, Exit, Layer } from "effect";
import { FileSystem } from "@effect/platform";
import { ProcessManagerService, ProcessManagerServiceLive } from "../ProcessManagerService.js";
import { NodeLaunchError } from "../errors.js";
import { spawn } from "node:child_process";
import * as fs from "node:fs";

// Mock child_process.spawn to prevent actual process spawning during tests
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const { EventEmitter } = await import("node:events");
  return {
    ...actual,
    spawn: vi.fn(() => {
      const mockProcess = new EventEmitter() as any;
      mockProcess.pid = 12345;
      mockProcess.stdout = new EventEmitter() as any;
      mockProcess.stderr = new EventEmitter() as any;
      mockProcess.kill = vi.fn();
      setTimeout(() => mockProcess.emit("exit", 0), 100);
      return mockProcess;
    }),
  };
});

// Mock fs.promises.mkdir/access
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      access: vi.fn(() => Promise.resolve()),
      mkdir: vi.fn(() => Promise.resolve()),
    },
  };
});

// Create a mock FileSystem layer for testing
const MockFileSystemLayer = Layer.succeed(
  FileSystem.FileSystem,
  FileSystem.FileSystem.of({
    writeFileString: vi.fn(() => Effect.void),
    access: vi.fn(() => Effect.void),
    exists: vi.fn(() => Effect.succeed(true)),
    readFileString: vi.fn(() => Effect.succeed("")),
    readFile: vi.fn(() => Effect.succeed(new Uint8Array())),
    writeFile: vi.fn(() => Effect.void),
    remove: vi.fn(() => Effect.void),
    truncate: vi.fn(() => Effect.void),
    readDirectory: vi.fn(() => Effect.succeed([])),
    stat: vi.fn(() => Effect.succeed({} as any)),
    chmod: vi.fn(() => Effect.void),
    chown: vi.fn(() => Effect.void),
    copy: vi.fn(() => Effect.void),
    copyFile: vi.fn(() => Effect.void),
    link: vi.fn(() => Effect.void),
    makeDirectory: vi.fn(() => Effect.void),
    makeTempDirectory: vi.fn(() => Effect.succeed("/tmp/test")),
    makeTempDirectoryScoped: vi.fn(() => Effect.succeed("/tmp/test")),
    makeTempFile: vi.fn(() => Effect.succeed("/tmp/test.txt")),
    makeTempFileScoped: vi.fn(() => Effect.succeed("/tmp/test.txt")),
    open: vi.fn(() => Effect.succeed({} as any)),
    readLink: vi.fn(() => Effect.succeed("/tmp/test")),
    realPath: vi.fn(() => Effect.succeed("/tmp/test")),
    rename: vi.fn(() => Effect.void),
    sink: vi.fn(() => ({}) as any),
    stream: vi.fn(() => ({}) as any),
    symlink: vi.fn(() => Effect.void),
    utimes: vi.fn(() => Effect.void),
    watch: vi.fn(() => ({}) as any),
  })
);

describe("ProcessManagerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.promises.access as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.resolve());
  });

  it("should launch a process and return cleanup function", async () => {
    const config = {
      command: "node",
      args: ["-e", "console.log('hello')"],
      name: "test-process",
      logDirectory: "/tmp/test_logs",
    };

    const program = ProcessManagerService.pipe(
      Effect.flatMap((service) =>
        service.launch(config).pipe(
          Effect.flatMap(({ result, cleanup }) =>
            Effect.sync(() => {
              expect(result.process.pid).toBeDefined();
              expect(result.logPath).toContain(config.logDirectory);
              expect(spawn).toHaveBeenCalledWith(config.command, config.args);
            }).pipe(
              Effect.flatMap(() => cleanup),
              Effect.tap(() =>
                Effect.sync(() => {
                  expect(result.process.kill).toHaveBeenCalledWith("SIGTERM");
                })
              )
            )
          )
        )
      ),
      Effect.provide(ProcessManagerServiceLive),
      Effect.provide(MockFileSystemLayer)
    );

    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it("should handle process launch failure", async () => {
    (spawn as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("Mock spawn error");
    });

    const config = {
      command: "invalid-command",
      args: [],
      name: "fail-process",
    };

    const program = ProcessManagerService.pipe(
      Effect.flatMap((service) => service.launch(config)),
      Effect.provide(ProcessManagerServiceLive),
      Effect.provide(MockFileSystemLayer)
    );

    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      const error = exit.cause.error;
      expect(error).toBeInstanceOf(NodeLaunchError);
      if (error instanceof NodeLaunchError) {
        expect(error.command).toBe(config.command);
      }
    }
  });

  it("should ensure log directory exists if not present", async () => {
    const config = {
      command: "node",
      args: ["-e", "console.log('hello')"],
      name: "test-process",
      logDirectory: "/tmp/new_test_logs",
    };

    (fs.promises.access as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new Error("ENOENT"))
    );

    const program = ProcessManagerService.pipe(
      Effect.flatMap((service) => service.launch(config)),
      Effect.provide(ProcessManagerServiceLive),
      Effect.provide(MockFileSystemLayer)
    );

    await Effect.runPromise(program);
    expect(fs.promises.mkdir).toHaveBeenCalledWith(config.logDirectory, {
      recursive: true,
    });
  });
});
