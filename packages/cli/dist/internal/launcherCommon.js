// src/internal/launcherCommon.ts
import chalk2 from "chalk";
import { execSync as execSync2 } from "child_process";
import fs2 from "fs";
import path3 from "path";

// src/lib/configReader.ts
import "@moonbeam-network/api-augment";
import { readFile, access } from "fs/promises";
import { readFileSync, existsSync, constants } from "fs";
import JSONC from "jsonc-parser";
import path, { extname } from "path";
var cachedConfig;
async function parseConfig(filePath) {
  let result;
  const file = await readFile(filePath, "utf8");
  switch (extname(filePath)) {
    case ".json":
      result = JSON.parse(file);
      break;
    case ".config":
      result = JSONC.parse(file);
      break;
    default:
      result = void 0;
      break;
  }
  return result;
}
async function importAsyncConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const configPath = process.env.MOON_CONFIG_PATH;
  if (!configPath) {
    throw new Error("No moonwall config path set. This is a defect, please raise it.");
  }
  const filePath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  try {
    const config = await parseConfig(filePath);
    const replacedConfig = replaceEnvVars(config);
    cachedConfig = replacedConfig;
    return cachedConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`);
  }
}
function replaceEnvVars(value) {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (match, group) => {
      const envVarValue = process.env[group];
      return envVarValue || match;
    });
  }
  if (Array.isArray(value)) {
    return value.map(replaceEnvVars);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceEnvVars(v)]));
  }
  return value;
}
function parseZombieConfigForBins(zombieConfigPath) {
  const config = JSON.parse(readFileSync(zombieConfigPath, "utf8"));
  const commands = [];
  if (config.relaychain?.default_command) {
    commands.push(path.basename(config.relaychain.default_command));
  }
  if (config.parachains) {
    for (const parachain of config.parachains) {
      if (parachain.collator?.command) {
        commands.push(path.basename(parachain.collator.command));
      }
    }
  }
  return [...new Set(commands)].sort();
}

// src/internal/fileCheckers.ts
import fs from "fs";
import { execSync } from "child_process";
import chalk from "chalk";
import os from "os";
import path2 from "path";
import { select } from "@inquirer/prompts";
async function downloadBinsIfMissing(binPath) {
  const binName = path2.basename(binPath);
  const binDir = path2.dirname(binPath);
  const binPathExists = fs.existsSync(binPath);
  if (!binPathExists && process.arch === "x64") {
    const download = await select({
      message: `The binary ${chalk.bgBlack.greenBright(
        binName
      )} is missing from ${chalk.bgBlack.greenBright(path2.join(process.cwd(), binDir))}.
Would you like to download it now?`,
      default: 0,
      choices: [
        { name: `Yes, download ${binName}`, value: true },
        { name: "No, quit program", value: false },
      ],
    });
    if (!download) {
      process.exit(0);
    } else {
      execSync(`mkdir -p ${binDir}`);
      execSync(`pnpm moonwall download ${binName} latest ${binDir}`, {
        stdio: "inherit",
      });
    }
  } else if (!binPathExists) {
    console.log(
      `The binary: ${chalk.bgBlack.greenBright(
        binName
      )} is missing from: ${chalk.bgBlack.greenBright(path2.join(process.cwd(), binDir))}`
    );
    console.log(
      `Given you are running ${chalk.bgBlack.yellowBright(
        process.arch
      )} architecture, you will need to build it manually from source \u{1F6E0}\uFE0F`
    );
    throw new Error("Executable binary not available");
  }
}
function checkListeningPorts(processId) {
  try {
    const stdOut = execSync(`lsof -p  ${processId} | grep LISTEN`, {
      encoding: "utf-8",
    });
    const binName = stdOut.split("\n")[0].split(" ")[0];
    const ports = stdOut
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const port = line.split(":")[1];
        return port.split(" ")[0];
      });
    const filtered = new Set(ports);
    return { binName, processId, ports: [...filtered].sort() };
  } catch (e) {
    const binName = execSync(`ps -p ${processId} -o comm=`).toString().trim();
    console.log(
      `Process ${processId} is running which for binary ${binName}, however it is unresponsive.`
    );
    console.log(
      "Running Moonwall with this in the background may cause unexpected behaviour. Please manually kill the process and try running Moonwall again."
    );
    console.log(`N.B. You can kill it with: sudo kill -9 ${processId}`);
    throw new Error(e);
  }
}
function checkAlreadyRunning(binaryName) {
  try {
    console.log(`Checking if ${chalk.bgWhiteBright.blackBright(binaryName)} is already running...`);
    const stdout = execSync(`pgrep ${[binaryName.slice(0, 14)]}`, {
      encoding: "utf8",
      timeout: 2e3,
    });
    const pIdStrings = stdout.split("\n").filter(Boolean);
    return pIdStrings.map((pId) => Number.parseInt(pId, 10));
  } catch (error) {
    if (error.status === 1) {
      return [];
    }
    throw error;
  }
}
async function promptAlreadyRunning(pids) {
  const alreadyRunning = await select({
    message: `The following processes are already running: 
${pids
  .map((pid) => {
    const { binName, ports } = checkListeningPorts(pid);
    return `${binName} - pid: ${pid}, listenPorts: [${ports.join(", ")}]`;
  })
  .join("\n")}`,
    default: 1,
    choices: [
      { name: "\u{1FA93}  Kill processes and continue", value: "kill" },
      { name: "\u27A1\uFE0F   Continue (and let processes live)", value: "continue" },
      { name: "\u{1F6D1}  Abort (and let processes live)", value: "abort" },
    ],
  });
  switch (alreadyRunning) {
    case "kill":
      for (const pid of pids) {
        execSync(`kill ${pid}`);
      }
      break;
    case "continue":
      break;
    case "abort":
      throw new Error("Abort Signal Picked");
  }
}

// src/internal/launcherCommon.ts
import Docker from "dockerode";
import { select as select2 } from "@inquirer/prompts";
async function commonChecks(env) {
  const globalConfig = await importAsyncConfig();
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
async function zombieBinCheck(env) {
  if (env.foundation.type !== "zombie") {
    throw new Error("This function is only for zombie environments");
  }
  const bins = parseZombieConfigForBins(env.foundation.zombieSpec.configPath);
  const pids = bins.flatMap((bin) => checkAlreadyRunning(bin));
  pids.length === 0 || process.env.CI || (await promptAlreadyRunning(pids));
}
async function devBinCheck(env) {
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
  const binName = path3.basename(env.foundation.launchSpec[0].binPath);
  const pids = checkAlreadyRunning(binName);
  pids.length === 0 || process.env.CI || (await promptAlreadyRunning(pids));
  await downloadBinsIfMissing(env.foundation.launchSpec[0].binPath);
}
async function promptKillContainers(matchingContainers) {
  const answer = await select2({
    message: `The following containers are already running image ${matchingContainers[0].Image}: ${matchingContainers.map(({ Id }) => Id).join(", ")}
 Would you like to kill them?`,
    choices: [
      { name: "\u{1FA93}  Kill containers", value: "kill" },
      { name: "\u{1F44B}   Quit", value: "goodbye" },
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
async function executeScript(scriptCommand, args) {
  const scriptsDir = (await importAsyncConfig()).scriptsDir;
  if (!scriptsDir) {
    throw new Error("No scriptsDir found in config");
  }
  const files = await fs2.promises.readdir(scriptsDir);
  try {
    const script = scriptCommand.split(" ")[0];
    const ext = path3.extname(script);
    const scriptPath = path3.join(process.cwd(), scriptsDir, scriptCommand);
    if (!files.includes(script)) {
      throw new Error(`Script ${script} not found in ${scriptsDir}`);
    }
    console.log(`========== Executing script: ${chalk2.bgGrey.greenBright(script)} ==========`);
    const argsString = args ? ` ${args}` : "";
    switch (ext) {
      case ".js":
        execSync2(`node ${scriptPath}${argsString}`, { stdio: "inherit" });
        break;
      case ".ts":
        execSync2(`pnpm tsx ${scriptPath}${argsString}`, { stdio: "inherit" });
        break;
      case ".sh":
        execSync2(`${scriptPath}${argsString}`, { stdio: "inherit" });
        break;
      default:
        console.log(`${ext} not supported, skipping ${script}`);
    }
  } catch (err) {
    console.error(`Error executing script: ${chalk2.bgGrey.redBright(err)}`);
    throw new Error(err);
  }
}
export { commonChecks, executeScript };
