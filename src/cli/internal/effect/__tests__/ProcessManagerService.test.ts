import { vi } from "vitest";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { ProcessManagerService, ProcessManagerServiceLive, NodeLaunchError } from "../index.js";
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
      mockProcess.kill = vi.fn(() => {
        // Simulate proper process termination
        setTimeout(() => {
          mockProcess.emit("close", 0, null);
        }, 10);
      });
      return mockProcess;
    }),
  };
});

// Mock fs to control createWriteStream and fs.promises
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const { EventEmitter } = await import("node:events");

  return {
    ...actual,
    createWriteStream: vi.fn(() => {
      const mockStream = new EventEmitter() as any;
      mockStream.write = vi.fn();
      mockStream.end = vi.fn();
      return mockStream;
    }),
    promises: {
      ...actual.promises,
      access: vi.fn(() => Promise.resolve()),
      mkdir: vi.fn(() => Promise.resolve()),
    },
  };
});

describe("ProcessManagerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.promises.access as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.resolve());
  });

  it.effect("should launch a process and return cleanup function", () => {
    const config = {
      command: "node",
      args: ["-e", "console.log('hello')"],
      name: "test-process",
      logDirectory: "/tmp/test_logs",
    };

    return ProcessManagerService.pipe(
      Effect.flatMap((service) =>
        service.launch(config).pipe(
          Effect.flatMap(({ result, cleanup }) =>
            Effect.sync(() => {
              expect(result.process.pid).toBeDefined();
              expect(result.logPath).toContain(config.logDirectory);
              expect(spawn).toHaveBeenCalledWith(config.command, config.args);
              expect(fs.createWriteStream).toHaveBeenCalledWith(
                expect.stringContaining(config.logDirectory),
                { flags: "a" }
              );
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
  });

  it.effect("should handle process launch failure", () => {
    (spawn as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("Mock spawn error");
    });

    const config = {
      command: "invalid-command",
      args: [],
      name: "fail-process",
    };

    return ProcessManagerService.pipe(
      Effect.flatMap((service) => service.launch(config)),
      Effect.provide(ProcessManagerServiceLive),
      Effect.flip,
      Effect.map((error) => {
        expect(error).toBeInstanceOf(NodeLaunchError);
        if (error instanceof NodeLaunchError) {
          expect(error.command).toBe(config.command);
        }
      })
    );
  });

  it.effect("should ensure log directory exists if not present", () => {
    const config = {
      command: "node",
      args: ["-e", "console.log('hello')"],
      name: "test-process",
      logDirectory: "/tmp/new_test_logs",
    };

    (fs.promises.access as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      Promise.reject(new Error("ENOENT"))
    );

    return ProcessManagerService.pipe(
      Effect.flatMap((service) => service.launch(config)),
      Effect.provide(ProcessManagerServiceLive),
      Effect.map(() => {
        expect(fs.promises.mkdir).toHaveBeenCalledWith(config.logDirectory, {
          recursive: true,
        });
      })
    );
  });
});
