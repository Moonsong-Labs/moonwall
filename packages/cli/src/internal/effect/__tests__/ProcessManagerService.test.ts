import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";
import { Effect, Exit } from "effect";
import { EventEmitter } from "node:events";

// Create mock functions that we can track
const mockKill = mock(() => true);
const mockWrite = mock(() => true);
const mockEnd = mock(() => {});
const mockMkdir = mock(() => Promise.resolve());
const mockAccess = mock(() => Promise.resolve());

// Create factory functions for mock objects
const createMockProcess = () => {
  const proc = new EventEmitter() as EventEmitter & {
    pid: number;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: typeof mockKill;
  };
  proc.pid = 12345;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = mock((signal?: string) => {
    // Simulate proper process termination
    setTimeout(() => {
      proc.emit("close", 0, null);
    }, 10);
    return true;
  });
  return proc;
};

const mockSpawn = mock(() => createMockProcess());

const createMockWriteStream = () => {
  const stream = new EventEmitter() as EventEmitter & {
    write: typeof mockWrite;
    end: typeof mockEnd;
  };
  stream.write = mockWrite;
  stream.end = mockEnd;
  return stream;
};

const mockCreateWriteStream = mock(() => createMockWriteStream());

// Mock child_process module
mock.module("node:child_process", () => ({
  spawn: mockSpawn,
}));

// Mock fs module
mock.module("node:fs", () => ({
  createWriteStream: mockCreateWriteStream,
  promises: {
    access: mockAccess,
    mkdir: mockMkdir,
  },
}));

// Import after mocking
const { ProcessManagerService, ProcessManagerServiceLive } = await import(
  "../ProcessManagerService.js"
);
const { NodeLaunchError } = await import("../errors.js");

describe("ProcessManagerService", () => {
  beforeEach(() => {
    // Reset mock call history
    mockSpawn.mockClear();
    mockCreateWriteStream.mockClear();
    mockAccess.mockClear();
    mockMkdir.mockClear();
    mockWrite.mockClear();
    mockEnd.mockClear();

    // Reset default implementations
    mockAccess.mockImplementation(() => Promise.resolve());
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
              expect(mockSpawn).toHaveBeenCalledWith(config.command, config.args);
              expect(mockCreateWriteStream).toHaveBeenCalled();
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
      Effect.provide(ProcessManagerServiceLive)
    );

    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it("should handle process launch failure", async () => {
    mockSpawn.mockImplementationOnce(() => {
      throw new Error("Mock spawn error");
    });

    const config = {
      command: "invalid-command",
      args: [],
      name: "fail-process",
    };

    const program = ProcessManagerService.pipe(
      Effect.flatMap((service) => service.launch(config)),
      Effect.provide(ProcessManagerServiceLive)
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

    mockAccess.mockImplementationOnce(() => Promise.reject(new Error("ENOENT")));

    const program = ProcessManagerService.pipe(
      Effect.flatMap((service) => service.launch(config)),
      Effect.provide(ProcessManagerServiceLive)
    );

    await Effect.runPromise(program);
    expect(mockMkdir).toHaveBeenCalledWith(config.logDirectory, {
      recursive: true,
    });
  });
});
