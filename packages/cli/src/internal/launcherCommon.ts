import { Environment } from "@moonwall/types";
import chalk from "chalk";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { importJsonConfig, parseZombieConfigForBins } from "../lib/configReader";
import { checkAlreadyRunning, downloadBinsIfMissing, promptAlreadyRunning } from "./fileCheckers";

export async function commonChecks(env: Environment) {
  const globalConfig = importJsonConfig();

  // TODO: This is begging for some Dependency Injection
  if (env.foundation.type == "dev") {
    await devBinCheck(env);
  }

  if (env.foundation.type == "zombie") {
    await zombieBinCheck(env);
  }

  if (
    process.env.MOON_RUN_SCRIPTS == "true" &&
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
  pids.length == 0 || process.env.CI || (await promptAlreadyRunning(pids));
}

async function devBinCheck(env: Environment) {
  if (env.foundation.type !== "dev") {
    throw new Error("This function is only for dev environments");
  }

  const binName = path.basename(env.foundation.launchSpec[0].binPath);
  const pids = checkAlreadyRunning(binName);
  pids.length == 0 || process.env.CI || (await promptAlreadyRunning(pids));
  await downloadBinsIfMissing(env.foundation.launchSpec[0].binPath);
}

async function executeScript(scriptCommand: string) {
  const scriptsDir = importJsonConfig().scriptsDir;
  const files = await fs.promises.readdir(scriptsDir);

  try {
    const script = scriptCommand.split(" ")[0];
    const ext = path.extname(script);
    const scriptPath = path.join(process.cwd(), scriptsDir, scriptCommand);

    if (!files.includes(script)) {
      throw new Error(`Script ${script} not found in ${scriptsDir}`);
    }

    console.log(`========== Executing script: ${chalk.bgGrey.greenBright(script)} ==========`);

    switch (ext) {
      case ".js":
        execSync("node " + scriptPath, { stdio: "inherit" });
        break;
      case ".ts":
        execSync("pnpm tsx " + scriptPath, { stdio: "inherit" });
        break;
      case ".sh":
        execSync(scriptPath, { stdio: "inherit" });
        break;
      default:
        console.log(`${ext} not supported, skipping ${script}`);
    }
  } catch (err) {
    console.error(`Error executing script: ${chalk.bgGrey.redBright(err)}`);
  }
}
