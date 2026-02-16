import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { NodeFileSystem } from "@effect/platform-node";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Environment } from "../../../../api/types/index.js";
import {
  zombieBinCheckEffect,
  devBinCheckEffect,
  executeScriptEffect,
  commonChecksEffect,
} from "../../launcherCommon.js";
import {
  CommandRunner,
  CommandRunnerError,
  Prompter,
  UserAbortError,
  DockerClient,
  ScriptExecutionError,
} from "../index.js";

// ─── Test Helpers ───────────────────────────────────────────────────

const makeTempDir = (): string => {
  return fs.mkdtempSync(path.join(os.tmpdir(), "launchercommon-test-"));
};

// ─── Mock Layers ────────────────────────────────────────────────────

/** CommandRunner where pgrep finds no processes */
const noProcessesRunner = Layer.succeed(CommandRunner, {
  exec: (command) => {
    if (command.startsWith("pgrep")) {
      return Effect.fail(new CommandRunnerError({ cause: { status: 1 }, command, exitCode: 1 }));
    }
    return Effect.succeed("");
  },
  execInherit: () => Effect.void,
});

/** CommandRunner where pgrep finds PIDs, lsof returns port info */
const runningProcessRunner = (pids: string, lsofOutput: string) =>
  Layer.succeed(CommandRunner, {
    exec: (command) => {
      if (command.startsWith("pgrep")) return Effect.succeed(pids);
      if (command.startsWith("lsof")) return Effect.succeed(lsofOutput);
      if (command.startsWith("kill")) return Effect.succeed("");
      if (command.startsWith("ps -p")) return Effect.succeed("node\n");
      return Effect.succeed("");
    },
    execInherit: () => Effect.void,
  });

const makePrompter = <T>(value: T) =>
  Layer.succeed(Prompter, {
    select: () => Effect.succeed(value) as Effect.Effect<any, UserAbortError>,
  });

/** DockerClient with no running containers */
const emptyDocker = Layer.succeed(DockerClient, {
  listContainers: () => Effect.succeed([]),
  stopContainer: () => Effect.void,
  removeContainer: () => Effect.void,
});

/** DockerClient with running containers */
const runningDocker = (containers: any[]) =>
  Layer.succeed(DockerClient, {
    listContainers: () => Effect.succeed(containers),
    stopContainer: () => Effect.void,
    removeContainer: () => Effect.void,
  });

// ─── Minimal Environment Fixtures ───────────────────────────────────

const makeDevEnv = (overrides?: { binPath?: string; useDocker?: boolean }): Environment =>
  ({
    name: "test-dev",
    testFileDir: [],
    foundation: {
      type: "dev" as const,
      launchSpec: [
        {
          binPath: overrides?.binPath ?? "/tmp/test-binary",
          useDocker: overrides?.useDocker ?? false,
          options: [],
        },
      ],
    },
  }) as unknown as Environment;

const makeReadOnlyEnv = (): Environment =>
  ({
    name: "test-readonly",
    testFileDir: [],
    foundation: {
      type: "read_only" as const,
    },
  }) as unknown as Environment;

// ─── Tests ──────────────────────────────────────────────────────────

describe("launcherCommon", () => {
  describe("zombieBinCheckEffect", () => {
    it.effect("should succeed when no processes are running", () =>
      zombieBinCheckEffect(["polkadot", "moonbeam"]).pipe(
        Effect.provide(Layer.mergeAll(noProcessesRunner, makePrompter("continue")))
      )
    );

    it.effect("should prompt when processes are found and user continues", () => {
      const lsofOutput = "polkadot 100 user   20u  IPv4  12345      0t0  TCP *:9944 (LISTEN)\n";
      const layers = Layer.mergeAll(
        runningProcessRunner("100\n", lsofOutput),
        makePrompter("continue")
      );

      return zombieBinCheckEffect(["polkadot"]).pipe(Effect.provide(layers));
    });

    it.effect("should fail with UserAbortError when user aborts", () => {
      const lsofOutput = "polkadot 100 user   20u  IPv4  12345      0t0  TCP *:9944 (LISTEN)\n";
      const layers = Layer.mergeAll(
        runningProcessRunner("100\n", lsofOutput),
        makePrompter("abort")
      );

      return zombieBinCheckEffect(["polkadot"]).pipe(
        Effect.provide(layers),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(UserAbortError);
        })
      );
    });
  });

  describe("devBinCheckEffect — non-Docker path", () => {
    it.effect("should check for running processes and download bins", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "test-binary");
      // Create the binary so downloadBinsIfMissing is a no-op
      fs.writeFileSync(binPath, "binary");

      const env = makeDevEnv({ binPath });
      const layers = Layer.mergeAll(
        noProcessesRunner,
        makePrompter("continue"),
        emptyDocker,
        NodeFileSystem.layer
      );

      return devBinCheckEffect(env).pipe(
        Effect.provide(layers),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });
  });

  describe("devBinCheckEffect — Docker path", () => {
    it.effect("should succeed when no containers are running", () => {
      const env = makeDevEnv({ useDocker: true, binPath: "moonbeam:latest" });
      const layers = Layer.mergeAll(
        noProcessesRunner,
        makePrompter("continue"),
        emptyDocker,
        NodeFileSystem.layer
      );

      return devBinCheckEffect(env).pipe(Effect.provide(layers));
    });

    it.effect("should prompt to kill containers when found (non-CI)", () => {
      const containers = [{ Id: "abc123def456", Image: "moonbeam:latest", Ports: [] }];
      const env = makeDevEnv({ useDocker: true, binPath: "moonbeam:latest" });

      // Docker returns empty after "kill"
      const dockerAfterKill = Layer.succeed(DockerClient, {
        listContainers: (() => {
          let called = false;
          return () => {
            if (!called) {
              called = true;
              return Effect.succeed(containers as any);
            }
            return Effect.succeed([]);
          };
        })(),
        stopContainer: () => Effect.void,
        removeContainer: () => Effect.void,
      });

      const layers = Layer.mergeAll(
        noProcessesRunner,
        makePrompter("kill"),
        dockerAfterKill,
        NodeFileSystem.layer
      );

      return devBinCheckEffect(env).pipe(Effect.provide(layers));
    });

    it.effect("should fail with UserAbortError when user quits", () => {
      const containers = [{ Id: "abc123def456", Image: "moonbeam:latest", Ports: [] }];
      const env = makeDevEnv({ useDocker: true, binPath: "moonbeam:latest" });
      const layers = Layer.mergeAll(
        noProcessesRunner,
        makePrompter("goodbye"),
        runningDocker(containers as any),
        NodeFileSystem.layer
      );

      return devBinCheckEffect(env).pipe(
        Effect.provide(layers),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(UserAbortError);
        })
      );
    });
  });

  describe("executeScriptEffect", () => {
    it.effect("should execute a .js script", () => {
      const tmpDir = makeTempDir();
      const scriptName = "setup.js";
      fs.writeFileSync(path.join(tmpDir, scriptName), "console.log('hi')");

      const commands: string[] = [];
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () => Effect.succeed(""),
        execInherit: (cmd) => {
          commands.push(cmd);
          return Effect.void;
        },
      });

      return executeScriptEffect(scriptName, tmpDir).pipe(
        Effect.provide(Layer.mergeAll(NodeFileSystem.layer, mockRunner)),
        Effect.map(() => {
          expect(commands).toHaveLength(1);
          expect(commands[0]).toContain("node");
          expect(commands[0]).toContain(scriptName);
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should execute a .ts script with pnpm tsx", () => {
      const tmpDir = makeTempDir();
      const scriptName = "setup.ts";
      fs.writeFileSync(path.join(tmpDir, scriptName), "console.log('hi')");

      const commands: string[] = [];
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () => Effect.succeed(""),
        execInherit: (cmd) => {
          commands.push(cmd);
          return Effect.void;
        },
      });

      return executeScriptEffect(scriptName, tmpDir).pipe(
        Effect.provide(Layer.mergeAll(NodeFileSystem.layer, mockRunner)),
        Effect.map(() => {
          expect(commands[0]).toContain("pnpm tsx");
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should execute a .sh script directly", () => {
      const tmpDir = makeTempDir();
      const scriptName = "setup.sh";
      fs.writeFileSync(path.join(tmpDir, scriptName), "#!/bin/sh\necho hi");

      const commands: string[] = [];
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () => Effect.succeed(""),
        execInherit: (cmd) => {
          commands.push(cmd);
          return Effect.void;
        },
      });

      return executeScriptEffect(scriptName, tmpDir).pipe(
        Effect.provide(Layer.mergeAll(NodeFileSystem.layer, mockRunner)),
        Effect.map(() => {
          expect(commands[0]).toContain(scriptName);
          expect(commands[0]).not.toContain("node");
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should skip unsupported extensions", () => {
      const tmpDir = makeTempDir();
      fs.writeFileSync(path.join(tmpDir, "data.json"), "{}");

      const commands: string[] = [];
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () => Effect.succeed(""),
        execInherit: (cmd) => {
          commands.push(cmd);
          return Effect.void;
        },
      });

      return executeScriptEffect("data.json", tmpDir).pipe(
        Effect.provide(Layer.mergeAll(NodeFileSystem.layer, mockRunner)),
        Effect.map(() => {
          expect(commands).toHaveLength(0);
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });

    it.effect("should fail with ScriptExecutionError for missing script", () => {
      const tmpDir = makeTempDir();
      const mockRunner = Layer.succeed(CommandRunner, {
        exec: () => Effect.succeed(""),
        execInherit: () => Effect.void,
      });

      return executeScriptEffect("nonexistent.js", tmpDir).pipe(
        Effect.provide(Layer.mergeAll(NodeFileSystem.layer, mockRunner)),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(ScriptExecutionError);
          expect((error as ScriptExecutionError).script).toBe("nonexistent.js");
        }),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });
  });

  describe("commonChecksEffect", () => {
    it.effect("should be a no-op for read_only foundations", () => {
      const env = makeReadOnlyEnv();
      const layers = Layer.mergeAll(
        noProcessesRunner,
        makePrompter("continue"),
        emptyDocker,
        NodeFileSystem.layer
      );

      return commonChecksEffect(env).pipe(Effect.provide(layers));
    });

    it.effect("should dispatch to devBinCheck for dev foundation", () => {
      const tmpDir = makeTempDir();
      const binPath = path.join(tmpDir, "test-binary");
      fs.writeFileSync(binPath, "binary");

      const env = makeDevEnv({ binPath });
      const layers = Layer.mergeAll(
        noProcessesRunner,
        makePrompter("continue"),
        emptyDocker,
        NodeFileSystem.layer
      );

      return commonChecksEffect(env).pipe(
        Effect.provide(layers),
        Effect.ensuring(Effect.sync(() => fs.rmSync(tmpDir, { recursive: true, force: true })))
      );
    });
  });
});
