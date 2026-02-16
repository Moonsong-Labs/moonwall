import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { NodeFileSystem } from "@effect/platform-node";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  getBinaryArchitectureEffect,
  checkExistsEffect,
  checkAccessEffect,
  checkAlreadyRunningEffect,
  checkListeningPortsEffect,
  promptAlreadyRunningEffect,
  downloadBinsIfMissingEffect,
} from "../../fileCheckers.js";
import {
  BinaryNotFoundError,
  BinaryArchMismatchError,
  BinaryPermissionError,
  UserAbortError,
  CommandRunner,
  CommandRunnerError,
  Prompter,
} from "../index.js";

// ─── Test Helpers ───────────────────────────────────────────────────

const makeTempDir = (): string => {
  return fs.mkdtempSync(path.join(os.tmpdir(), "filecheckers-test-"));
};

/**
 * Write a minimal ELF binary header with a given e_machine value.
 * Bytes 0-3: ELF magic, bytes 18-19: e_machine (LE).
 */
const writeElfHeader = (filePath: string, eMachine: number) => {
  const buf = Buffer.alloc(20);
  // ELF magic
  buf.writeUInt8(0x7f, 0);
  buf.writeUInt8(0x45, 1);
  buf.writeUInt8(0x4c, 2);
  buf.writeUInt8(0x46, 3);
  // e_machine at offset 18
  buf.writeUInt16LE(eMachine, 18);
  fs.writeFileSync(filePath, buf);
};

// ─── Mock Layers ────────────────────────────────────────────────────

/** CommandRunner that returns configurable responses per command prefix */
const makeCommandRunner = (handlers: Record<string, string | Error>) =>
  Layer.succeed(CommandRunner, {
    exec: (command) => {
      for (const [prefix, response] of Object.entries(handlers)) {
        if (command.startsWith(prefix)) {
          if (response instanceof Error) {
            return Effect.fail(
              new CommandRunnerError({
                cause: response,
                command,
                exitCode: (response as any).exitCode,
              })
            );
          }
          return Effect.succeed(response);
        }
      }
      return Effect.fail(new CommandRunnerError({ cause: "unhandled command", command }));
    },
    execInherit: () => Effect.void,
  });

/** Prompter that always returns a fixed value */
const makePrompter = <T>(value: T) =>
  Layer.succeed(Prompter, {
    select: () => Effect.succeed(value) as Effect.Effect<any, UserAbortError>,
  });

// ─── Tests ──────────────────────────────────────────────────────────

describe("fileCheckers", () => {
  describe("getBinaryArchitectureEffect", () => {
    it.effect("should read x64 architecture from ELF header", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "test-bin");
      writeElfHeader(binPath, 62); // x64

      return getBinaryArchitectureEffect(binPath).pipe(
        Effect.map((arch) => {
          expect(arch).toBe("x64");
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should read arm64 architecture from ELF header", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "test-bin");
      writeElfHeader(binPath, 183); // arm64

      return getBinaryArchitectureEffect(binPath).pipe(
        Effect.map((arch) => {
          expect(arch).toBe("arm64");
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should return unknown for unrecognized e_machine", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "test-bin");
      writeElfHeader(binPath, 999);

      return getBinaryArchitectureEffect(binPath).pipe(
        Effect.map((arch) => {
          expect(arch).toBe("unknown");
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should fail with BinaryNotFoundError for missing file", () =>
      getBinaryArchitectureEffect("/nonexistent/path/binary").pipe(
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(BinaryNotFoundError);
        })
      )
    );
  });

  describe("checkExistsEffect", () => {
    it.effect("should succeed when binary exists with matching architecture", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "test-bin");
      // Write ELF header matching current arch
      const archMap: Record<string, number> = { x64: 62, arm64: 183, x86: 3 };
      writeElfHeader(binPath, archMap[os.arch()] ?? 0);

      return checkExistsEffect(binPath).pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.map((result) => {
          expect(result).toBe(true);
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should fail with BinaryNotFoundError when file missing", () =>
      checkExistsEffect("/nonexistent/binary").pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(BinaryNotFoundError);
          expect((error as BinaryNotFoundError).path).toBe("/nonexistent/binary");
        })
      )
    );

    it.effect("should fail with BinaryArchMismatchError on arch mismatch", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "test-bin");
      // Write a different arch than the current system
      const wrongArch = os.arch() === "x64" ? 183 : 62;
      writeElfHeader(binPath, wrongArch);

      return checkExistsEffect(binPath).pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(BinaryArchMismatchError);
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should strip args from path (e.g. 'binary --flag')", () =>
      checkExistsEffect("/nonexistent/binary --some-flag").pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(BinaryNotFoundError);
          expect((error as BinaryNotFoundError).path).toBe("/nonexistent/binary");
        })
      )
    );
  });

  describe("checkAccessEffect", () => {
    it.effect("should succeed when file is executable", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "test-bin");
      fs.writeFileSync(binPath, "#!/bin/sh\n");
      fs.chmodSync(binPath, 0o755);

      return checkAccessEffect(binPath).pipe(
        Effect.map(() => {
          expect(true).toBe(true);
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should fail with BinaryPermissionError when not executable", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "test-bin");
      fs.writeFileSync(binPath, "#!/bin/sh\n");
      fs.chmodSync(binPath, 0o644); // No execute permission

      return checkAccessEffect(binPath).pipe(
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(BinaryPermissionError);
          expect((error as BinaryPermissionError).path).toBe(binPath);
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });
  });

  describe("checkAlreadyRunningEffect", () => {
    it.effect("should return PIDs when pgrep finds processes", () => {
      const mockRunner = makeCommandRunner({
        "pgrep -x": "1234\n5678\n",
      });

      return checkAlreadyRunningEffect("myprocess").pipe(
        Effect.provide(mockRunner),
        Effect.map((pids) => {
          expect(pids).toEqual([1234, 5678]);
        })
      );
    });

    it.effect("should return empty array when pgrep exits with status 1", () => {
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () =>
          Effect.fail(
            new CommandRunnerError({
              cause: { status: 1 },
              command: "pgrep",
              exitCode: 1,
            })
          ),
        execInherit: () => Effect.void,
      });

      return checkAlreadyRunningEffect("myprocess").pipe(
        Effect.provide(mockRunner),
        Effect.map((pids) => {
          expect(pids).toEqual([]);
        })
      );
    });

    it.effect("should propagate real pgrep errors (non-status-1)", () => {
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () =>
          Effect.fail(
            new CommandRunnerError({
              cause: new Error("pgrep crashed"),
              command: "pgrep",
              exitCode: 2,
            })
          ),
        execInherit: () => Effect.void,
      });

      return checkAlreadyRunningEffect("myprocess").pipe(
        Effect.provide(mockRunner),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(CommandRunnerError);
          expect((error as CommandRunnerError).exitCode).toBe(2);
        })
      );
    });
  });

  describe("checkListeningPortsEffect", () => {
    it.effect("should parse lsof output into port info", () => {
      const lsofOutput =
        "node    1234 user   20u  IPv4  12345      0t0  TCP *:9944 (LISTEN)\nnode    1234 user   21u  IPv4  12346      0t0  TCP *:9945 (LISTEN)\n";
      const mockRunner = makeCommandRunner({
        "lsof -p": lsofOutput,
      });

      return checkListeningPortsEffect(1234).pipe(
        Effect.provide(mockRunner),
        Effect.map(({ binName, processId, ports }) => {
          expect(binName).toBe("node");
          expect(processId).toBe(1234);
          expect(ports).toEqual(["9944", "9945"]);
        })
      );
    });

    it.effect("should log fallback info and fail when lsof fails", () => {
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: (command) => {
          if (command.startsWith("lsof")) {
            return Effect.fail(
              new CommandRunnerError({ cause: "lsof failed", command, exitCode: 1 })
            );
          }
          if (command.startsWith("ps -p")) {
            return Effect.succeed("moonbeam\n");
          }
          return Effect.fail(new CommandRunnerError({ cause: "unhandled", command }));
        },
        execInherit: () => Effect.void,
      });

      return checkListeningPortsEffect(999).pipe(
        Effect.provide(mockRunner),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(CommandRunnerError);
        })
      );
    });
  });

  describe("promptAlreadyRunningEffect", () => {
    const lsofOutput = "node    42 user   20u  IPv4  12345      0t0  TCP *:9944 (LISTEN)\n";

    it.effect("should kill processes when user selects kill", () => {
      const killedPids: number[] = [];
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: (command) => {
          if (command.startsWith("lsof")) return Effect.succeed(lsofOutput);
          if (command.startsWith("kill")) {
            killedPids.push(Number.parseInt(command.split(" ")[1], 10));
            return Effect.succeed("");
          }
          return Effect.fail(new CommandRunnerError({ cause: "unhandled", command }));
        },
        execInherit: () => Effect.void,
      });
      const mockPrompter = makePrompter("kill");

      return promptAlreadyRunningEffect([42]).pipe(
        Effect.provide(Layer.mergeAll(mockRunner, mockPrompter)),
        Effect.map(() => {
          expect(killedPids).toEqual([42]);
        })
      );
    });

    it.effect("should do nothing when user selects continue", () => {
      const mockRunner = makeCommandRunner({ "lsof -p": lsofOutput });
      const mockPrompter = makePrompter("continue");

      return promptAlreadyRunningEffect([42]).pipe(
        Effect.provide(Layer.mergeAll(mockRunner, mockPrompter)),
        Effect.map(() => {
          expect(true).toBe(true);
        })
      );
    });

    it.effect("should fail with UserAbortError when user selects abort", () => {
      const mockRunner = makeCommandRunner({ "lsof -p": lsofOutput });
      const mockPrompter = makePrompter("abort");

      return promptAlreadyRunningEffect([42]).pipe(
        Effect.provide(Layer.mergeAll(mockRunner, mockPrompter)),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(UserAbortError);
          expect((error as UserAbortError).context).toBe("promptAlreadyRunning");
        })
      );
    });
  });

  describe("downloadBinsIfMissingEffect", () => {
    it.effect("should do nothing when binary exists", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "existing-bin");
      fs.writeFileSync(binPath, "binary content");

      // Prompter and CommandRunner should never be called
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () => Effect.die("should not be called"),
        execInherit: () => Effect.die("should not be called"),
      });
      const mockPrompter = makePrompter(true);

      return downloadBinsIfMissingEffect(binPath).pipe(
        Effect.provide(Layer.mergeAll(NodeFileSystem.layer, mockRunner, mockPrompter)),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should fail with UserAbortError when user declines download", () => {
      const mockPrompter = makePrompter(false);
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () => Effect.succeed(""),
        execInherit: () => Effect.void,
      });

      // Use a path that doesn't exist, and mock process.arch check by testing on x64
      // This test only runs meaningfully on x64
      const result = downloadBinsIfMissingEffect("/nonexistent/dir/some-binary").pipe(
        Effect.provide(Layer.mergeAll(NodeFileSystem.layer, mockRunner, mockPrompter)),
        Effect.exit
      );

      return result.pipe(
        Effect.map((exit) => {
          if (process.arch === "x64") {
            expect(Exit.isFailure(exit)).toBe(true);
          }
          // On non-x64, it fails with BinaryNotFoundError instead
        })
      );
    });

    it.effect("should run download commands when user accepts", () => {
      const commands: string[] = [];
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () => Effect.succeed(""),
        execInherit: (command) => {
          commands.push(command);
          return Effect.void;
        },
      });
      const mockPrompter = makePrompter(true);

      return downloadBinsIfMissingEffect("/nonexistent/dir/some-binary").pipe(
        Effect.provide(Layer.mergeAll(NodeFileSystem.layer, mockRunner, mockPrompter)),
        Effect.exit,
        Effect.map((exit) => {
          if (process.arch === "x64") {
            expect(Exit.isSuccess(exit)).toBe(true);
            expect(commands).toHaveLength(2);
            expect(commands[0]).toContain("mkdir -p");
            expect(commands[1]).toContain("pnpm moonwall download");
          }
        })
      );
    });
  });
});
