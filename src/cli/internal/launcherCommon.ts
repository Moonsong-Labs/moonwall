import type { Environment } from "../../api/types/index.js";
import chalk from "chalk";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { importAsyncConfig, parseZombieConfigForBins } from "../lib/configReader.js";
import {
  checkAlreadyRunningEffect,
  downloadBinsIfMissingEffect,
  promptAlreadyRunningEffect,
} from "./fileCheckers.js";
import Docker from "dockerode";
import { select } from "@inquirer/prompts";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { ScriptExecutionError, UserAbortError } from "../../services/errors.js";

// ─── Internal Effect Functions ──────────────────────────────────────

/**
 * Check zombie environment binaries for already-running processes.
 */
export const zombieBinCheckEffect = (env: Environment) =>
  Effect.gen(function* () {
    if (env.foundation.type !== "zombie") {
      return yield* Effect.die(new Error("This function is only for zombie environments"));
    }

    const bins = parseZombieConfigForBins(env.foundation.zombieSpec.configPath);
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
    const answer = yield* Effect.tryPromise({
      try: () =>
        select({
          message: `The following containers are already running image ${matchingContainers[0].Image}: ${matchingContainers.map(({ Id }) => Id).join(", ")}\n Would you like to kill them?`,
          choices: [
            { name: "🪓  Kill containers", value: "kill" as const },
            { name: "👋   Quit", value: "goodbye" as const },
          ],
        }),
      catch: (cause) => new UserAbortError({ cause, context: "promptKillContainers" }),
    });

    if (answer === "goodbye") {
      console.log("Goodbye!");
      return yield* Effect.fail(
        new UserAbortError({ cause: "User quit", context: "promptKillContainers" })
      );
    }

    if (answer === "kill") {
      const docker = new Docker();
      for (const { Id } of matchingContainers) {
        const container = docker.getContainer(Id);
        yield* Effect.tryPromise(() => container.stop());
        yield* Effect.tryPromise(() => container.remove());
      }

      const containers = yield* Effect.tryPromise(() =>
        docker.listContainers({
          filters: { ancestor: matchingContainers.map(({ Image }) => Image) },
        })
      );

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
      const docker = new Docker();
      const imageName = launchSpec.binPath;

      console.log(`Checking if ${imageName} is running...`);
      const matchingContainers = yield* Effect.tryPromise(() =>
        docker.listContainers({ filters: { ancestor: [imageName] } })
      ).pipe(Effect.map((containers) => containers.flat()));

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
 * Execute a script from the configured scriptsDir.
 */
export const executeScriptEffect = (scriptCommand: string, args?: string) =>
  Effect.gen(function* () {
    const globalConfig = yield* Effect.promise(() => importAsyncConfig());
    const scriptsDir = globalConfig.scriptsDir;

    if (!scriptsDir) {
      return yield* Effect.die(new Error("No scriptsDir found in config"));
    }

    const files = yield* Effect.tryPromise({
      try: () => fs.promises.readdir(scriptsDir),
      catch: (cause) => new ScriptExecutionError({ cause, script: scriptCommand, scriptsDir }),
    });

    const script = scriptCommand.split(" ")[0];
    const ext = path.extname(script);
    const scriptPath = path.join(process.cwd(), scriptsDir, scriptCommand);

    if (!files.includes(script)) {
      const err = new ScriptExecutionError({
        cause: new Error(`Script ${script} not found in ${scriptsDir}`),
        script,
        scriptsDir,
      });
      console.error(`Error executing script: ${chalk.bgGrey.redBright(err.cause)}`);
      return yield* Effect.fail(err);
    }

    console.log(`========== Executing script: ${chalk.bgGrey.greenBright(script)} ==========`);

    const argsString = args ? ` ${args}` : "";
    yield* Effect.try({
      try: () => {
        switch (ext) {
          case ".js":
            execSync(`node ${scriptPath}${argsString}`, { stdio: "inherit" });
            break;
          case ".ts":
            execSync(`pnpm tsx ${scriptPath}${argsString}`, { stdio: "inherit" });
            break;
          case ".sh":
            execSync(`${scriptPath}${argsString}`, { stdio: "inherit" });
            break;
          default:
            console.log(`${ext} not supported, skipping ${script}`);
        }
      },
      catch: (cause) => {
        console.error(`Error executing script: ${chalk.bgGrey.redBright(cause)}`);
        return new ScriptExecutionError({ cause, script, scriptsDir });
      },
    });
  });

/**
 * Orchestrate all pre-launch checks by foundation type.
 */
export const commonChecksEffect = (env: Environment) =>
  Effect.gen(function* () {
    const globalConfig = yield* Effect.promise(() => importAsyncConfig());

    if (env.foundation.type === "dev") {
      yield* devBinCheckEffect(env);
    }

    if (env.foundation.type === "zombie") {
      yield* zombieBinCheckEffect(env);
    }

    if (
      process.env.MOON_RUN_SCRIPTS === "true" &&
      globalConfig.scriptsDir &&
      env.runScripts &&
      env.runScripts.length > 0
    ) {
      for (const scriptCommand of env.runScripts) {
        yield* executeScriptEffect(scriptCommand);
      }
    }
  });

// ─── Public Wrappers (preserve existing caller contract) ────────────

export async function commonChecks(env: Environment) {
  return commonChecksEffect(env).pipe(
    Effect.provide(NodeFileSystem.layer),
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
  return executeScriptEffect(scriptCommand, args).pipe(Effect.runPromise);
}
