import type { Environment } from "@moonwall/types";
import chalk from "chalk";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { importAsyncConfig, parseZombieConfigForBins } from "../lib/configReader";
import { checkAlreadyRunning, downloadBinsIfMissing, promptAlreadyRunning } from "./fileCheckers";
import Docker from "dockerode";
import { select } from "@inquirer/prompts";

export async function commonChecks(env: Environment) {
  const globalConfig = await importAsyncConfig();

  // TODO: This is begging for some Dependency Injection
  if (env.foundation.type === "dev") {
    await devBinCheck(env);
  }

  if (env.foundation.type === "zombie") {
    await zombieBinCheck(env);
  }

  if (
    process.env.MOON_RUN_SCRIPTS === "true" &&
    globalConfig.scriptsDir &&
    env.runScripts &&
    env.runScripts.length > 0
  ) {
    for (const scriptCommand of env.runScripts) {
      await executeScript(scriptCommand);
    }
  }
}

async function zombieBinCheck(env: Environment) {
  if (env.foundation.type !== "zombie") {
    throw new Error("This function is only for zombie environments");
  }

  const bins = parseZombieConfigForBins(env.foundation.zombieSpec.configPath);
  const pids = bins.flatMap((bin) => checkAlreadyRunning(bin));
  pids.length === 0 || process.env.CI || (await promptAlreadyRunning(pids));
}

async function devBinCheck(env: Environment) {
  if (env.foundation.type !== "dev") {
    throw new Error("This function is only for dev environments");
  }

  if (!env.foundation.launchSpec || !env.foundation.launchSpec[0]) {
    throw new Error("Dev environment requires a launchSpec configuration");
  }

  if (env.foundation.launchSpec[0].useDocker) {
    const docker = new Docker();
    const imageName = env.foundation.launchSpec[0].binPath;

    console.log(`Checking if ${imageName} is running...`);
    const matchingContainers = (
      await docker.listContainers({
        filters: { ancestor: [imageName] },
      })
    ).flat();

    if (matchingContainers.length === 0) {
      return;
    }

    if (!process.env.CI) {
      await promptKillContainers(matchingContainers);
      return;
    }

    const runningContainers = matchingContainers.map(({ Id, Ports }) => ({
      Id: Id.slice(0, 12),
      Ports: Ports.map(({ PublicPort, PrivatePort }) =>
        PublicPort ? `${PublicPort} -> ${PrivatePort}` : `${PrivatePort}`
      ).join(", "),
    }));

    console.table(runningContainers);

    throw new Error(`${imageName} is already running, aborting`);
  }

  const binName = path.basename(env.foundation.launchSpec[0].binPath);
  const pids = checkAlreadyRunning(binName);
  pids.length === 0 || process.env.CI || (await promptAlreadyRunning(pids));
  await downloadBinsIfMissing(env.foundation.launchSpec[0].binPath);
}

async function promptKillContainers(matchingContainers: Docker.ContainerInfo[]) {
  const answer = await select({
    message: `The following containers are already running image ${matchingContainers[0].Image}: ${matchingContainers.map(({ Id }) => Id).join(", ")}\n Would you like to kill them?`,
    choices: [
      { name: "🪓  Kill containers", value: "kill" },
      { name: "👋   Quit", value: "goodbye" },
    ],
  });

  if (answer === "goodbye") {
    console.log("Goodbye!");
    process.exit(0);
  }

  if (answer === "kill") {
    const docker = new Docker();
    for (const { Id } of matchingContainers) {
      const container = docker.getContainer(Id);
      await container.stop();
      await container.remove();
    }

    const containers = await docker.listContainers({
      filters: { ancestor: matchingContainers.map(({ Image }) => Image) },
    });

    if (containers.length > 0) {
      console.error(
        `The following containers are still running: ${containers.map(({ Id }) => Id).join(", ")}`
      );
      process.exit(1);
    }

    return;
  }
}

export async function executeScript(scriptCommand: string, args?: string) {
  const scriptsDir = (await importAsyncConfig()).scriptsDir;

  if (!scriptsDir) {
    throw new Error("No scriptsDir found in config");
  }

  const files = await fs.promises.readdir(scriptsDir);

  try {
    const script = scriptCommand.split(" ")[0];
    const ext = path.extname(script);
    const scriptPath = path.join(process.cwd(), scriptsDir, scriptCommand);

    if (!files.includes(script)) {
      throw new Error(`Script ${script} not found in ${scriptsDir}`);
    }

    console.log(`========== Executing script: ${chalk.bgGrey.greenBright(script)} ==========`);

    const argsString = args ? ` ${args}` : "";
    switch (ext) {
      case ".js":
        execSync(`node ${scriptPath}${argsString}`, { stdio: "inherit" });
        break;
      case ".ts":
        execSync(`node --import=tsx ${scriptPath}${argsString}`, { stdio: "inherit" });
        break;
      case ".sh":
        execSync(`${scriptPath}${argsString}`, { stdio: "inherit" });
        break;
      default:
        console.log(`${ext} not supported, skipping ${script}`);
    }
  } catch (err: any) {
    console.error(`Error executing script: ${chalk.bgGrey.redBright(err)}`);
    throw new Error(err);
  }
}
