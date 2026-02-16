import type { Environment } from "../../api/types/index.js";
import chalk from "chalk";
import type Docker from "dockerode";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { importAsyncConfig, parseZombieConfigForBins } from "../lib/configReader.js";
import {
  checkAlreadyRunningEffect,
  downloadBinsIfMissingEffect,
  promptAlreadyRunningEffect,
} from "./fileCheckers.js";
import { Effect, Layer } from "effect";
import { ScriptExecutionError, UserAbortError } from "../../services/errors.js";
import { CommandRunner, CommandRunnerLive } from "../../services/CommandRunner.js";
import { Prompter, PrompterLive } from "../../services/Prompter.js";
import { DockerClient, DockerClientLive } from "../../services/DockerClient.js";

// ─── Internal Effect Functions ──────────────────────────────────────

/**
 * Check zombie environment binaries for already-running processes.
 * Takes resolved bins list to avoid config-reader dependency in tests.
 */
export const zombieBinCheckEffect = (bins: string[]) =>
  Effect.gen(function* () {
    const pids = yield* Effect.forEach(bins, (bin) => checkAlreadyRunningEffect(bin)).pipe(
      Effect.map((results) => results.flat())
    );

    if (pids.length > 0 && !process.env.CI) {
      yield* promptAlreadyRunningEffect(pids);
    }
  });

/**
 * Prompt user to handle already-running Docker containers.
 * Fails with UserAbortError on quit, dies on failed container cleanup.
 */
const promptKillContainersEffect = (matchingContainers: Docker.ContainerInfo[]) =>
  Effect.gen(function* () {
    const prompter = yield* Prompter;
    const docker = yield* DockerClient;

    const answer = yield* prompter.select({
      message: `The following containers are already running image ${matchingContainers[0].Image}: ${matchingContainers.map(({ Id }) => Id).join(", ")}\n Would you like to kill them?`,
      choices: [
        { name: "🪓  Kill containers", value: "kill" as const },
        { name: "👋   Quit", value: "goodbye" as const },
      ],
    });

    if (answer === "goodbye") {
      console.log("Goodbye!");
      return yield* Effect.fail(
        new UserAbortError({ cause: "User quit", context: "promptKillContainers" })
      );
    }

    if (answer === "kill") {
      for (const { Id } of matchingContainers) {
        yield* docker.stopContainer(Id);
        yield* docker.removeContainer(Id);
      }

      const containers = yield* docker.listContainers({
        ancestor: matchingContainers.map(({ Image }) => Image),
      });

      if (containers.length > 0) {
        console.error(
          `The following containers are still running: ${containers.map(({ Id }) => Id).join(", ")}`
        );
        return yield* Effect.die(new Error("Failed to kill all containers"));
      }
    }
  });

/**
 * Check dev environment: Docker containers or binary processes.
 */
export const devBinCheckEffect = (env: Environment) =>
  Effect.gen(function* () {
    if (env.foundation.type !== "dev") {
      return yield* Effect.die(new Error("This function is only for dev environments"));
    }

    if (!env.foundation.launchSpec || !env.foundation.launchSpec[0]) {
      return yield* Effect.die(new Error("Dev environment requires a launchSpec configuration"));
    }

    const launchSpec = env.foundation.launchSpec[0];

    if (launchSpec.useDocker) {
      const docker = yield* DockerClient;
      const imageName = launchSpec.binPath;

      console.log(`Checking if ${imageName} is running...`);
      const matchingContainers = yield* docker
        .listContainers({ ancestor: [imageName] })
        .pipe(Effect.map((containers) => containers.flat()));

      if (matchingContainers.length === 0) {
        return;
      }

      if (!process.env.CI) {
        yield* promptKillContainersEffect(matchingContainers);
        return;
      }

      const runningContainers = matchingContainers.map(({ Id, Ports }: Docker.ContainerInfo) => ({
        Id: Id.slice(0, 12),
        Ports: Ports.map(({ PublicPort, PrivatePort }: Docker.Port) =>
          PublicPort ? `${PublicPort} -> ${PrivatePort}` : `${PrivatePort}`
        ).join(", "),
      }));

      console.table(runningContainers);
      return yield* Effect.die(new Error(`${imageName} is already running, aborting`));
    }

    const binName = path.basename(launchSpec.binPath);
    const pids = yield* checkAlreadyRunningEffect(binName);

    if (pids.length > 0 && !process.env.CI) {
      yield* promptAlreadyRunningEffect(pids);
    }

    yield* downloadBinsIfMissingEffect(launchSpec.binPath);
  });

/**
 * Execute a script from a given scriptsDir.
 * Takes scriptsDir as parameter to avoid config-reader dependency in tests.
 */
export const executeScriptEffect = (scriptCommand: string, scriptsDir: string, args?: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const runner = yield* CommandRunner;

    const files = yield* fileSystem
      .readDirectory(scriptsDir)
      .pipe(
        Effect.mapError(
          (cause) => new ScriptExecutionError({ cause, script: scriptCommand, scriptsDir })
        )
      );

    const script = scriptCommand.split(" ")[0];
    const ext = path.extname(script);
    const scriptPath = path.join(process.cwd(), scriptsDir, scriptCommand);

    if (!files.includes(script)) {
      const err = new ScriptExecutionError({
        cause: new Error(`Script ${script} not found in ${scriptsDir}`),
        script,
        scriptsDir,
      });
      console.error(`Error executing script: ${chalk.bgGrey.redBright(String(err.cause))}`);
      return yield* Effect.fail(err);
    }

    console.log(`========== Executing script: ${chalk.bgGrey.greenBright(script)} ==========`);

    const argsString = args ? ` ${args}` : "";
    switch (ext) {
      case ".js":
        yield* runner.execInherit(`node ${scriptPath}${argsString}`);
        break;
      case ".ts":
        yield* runner.execInherit(`pnpm tsx ${scriptPath}${argsString}`);
        break;
      case ".sh":
        yield* runner.execInherit(`${scriptPath}${argsString}`);
        break;
      default:
        console.log(`${ext} not supported, skipping ${script}`);
    }
  });

/**
 * Orchestrate all pre-launch checks by foundation type.
 * Takes resolved config to avoid config-reader dependency in tests.
 */
export const commonChecksEffect = (env: Environment, scriptsDir?: string) =>
  Effect.gen(function* () {
    if (env.foundation.type === "dev") {
      yield* devBinCheckEffect(env);
    }

    if (env.foundation.type === "zombie") {
      const bins = parseZombieConfigForBins(env.foundation.zombieSpec.configPath);
      yield* zombieBinCheckEffect(bins);
    }

    if (
      process.env.MOON_RUN_SCRIPTS === "true" &&
      scriptsDir &&
      env.runScripts &&
      env.runScripts.length > 0
    ) {
      for (const scriptCommand of env.runScripts) {
        yield* executeScriptEffect(scriptCommand, scriptsDir);
      }
    }
  });

// ─── Public Wrappers (preserve existing caller contract) ────────────

const liveLayers = Layer.mergeAll(
  NodeFileSystem.layer,
  CommandRunnerLive,
  PrompterLive,
  DockerClientLive
);

export async function commonChecks(env: Environment) {
  const globalConfig = await importAsyncConfig();
  return commonChecksEffect(env, globalConfig.scriptsDir).pipe(
    Effect.provide(liveLayers),
    Effect.catchTag(
      "UserAbortError",
      (): Effect.Effect<void> =>
        Effect.sync(() => {
          process.exit(0);
        })
    ),
    Effect.runPromise
  );
}

export async function executeScript(scriptCommand: string, args?: string) {
  const globalConfig = await importAsyncConfig();
  if (!globalConfig.scriptsDir) {
    throw new Error("No scriptsDir found in config");
  }
  return executeScriptEffect(scriptCommand, globalConfig.scriptsDir, args).pipe(
    Effect.provide(liveLayers),
    Effect.runPromise
  );
}
