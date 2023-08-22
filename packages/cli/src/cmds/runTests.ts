import { Environment } from "@moonwall/types";
import chalk from "chalk";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "path";
import { clearNodeLogs } from "../internal/cmdFunctions/tempLogs";
import { UserConfig } from "vitest";
import { startVitest } from "vitest/node";
import {
  checkAlreadyRunning,
  downloadBinsIfMissing,
  promptAlreadyRunning,
} from "../internal/fileCheckers";
import { importJsonConfig, loadEnvVars, parseZombieConfigForBins } from "../lib/configReader";
import { contextCreator } from "../lib/globalContext";

export async function testCmd(envName: string, additionalArgs?: {}) {
  const globalConfig = importJsonConfig();
  const env = globalConfig.environments.find(({ name }) => name === envName)!;
  process.env.MOON_TEST_ENV = envName;

  if (!!!env) {
    const envList = globalConfig.environments.map((env) => env.name);
    throw new Error(
      `No environment found in config for: ${chalk.bgWhiteBright.blackBright(
        envName
      )}\n Environments defined in config are: ${envList}\n`
    );
  }
  loadEnvVars();

  if (env.foundation.type == "dev") {
    const binName = path.basename(env.foundation.launchSpec[0].binPath);
    const pids = checkAlreadyRunning(binName);
    pids.length == 0 || (await promptAlreadyRunning(pids));
    await downloadBinsIfMissing(env.foundation.launchSpec[0].binPath);
  }

  if (env.foundation.type == "zombie") {
    const bins = parseZombieConfigForBins(env.foundation.zombieSpec.configPath);
    const pids = bins.flatMap((bin) => checkAlreadyRunning(bin));
    pids.length == 0 || (await promptAlreadyRunning(pids));
  }

  if (
    process.env.MOON_RUN_SCRIPTS == "true" &&
    globalConfig.scriptsDir &&
    env.runScripts &&
    env.runScripts.length > 0
  ) {
    const scriptsDir = globalConfig.scriptsDir;
    const files = await fs.promises.readdir(scriptsDir);

    for (const scriptCommand of env.runScripts) {
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
  }
  if (env.foundation.type == "dev" && !env.foundation.launchSpec[0].retainAllLogs) {
    clearNodeLogs();
  }
  const vitest = await executeTests(env, additionalArgs);
  const failed = vitest!.state.getFiles().filter((file) => file.result!.state === "fail");

  if (failed.length > 0) {
    process.stderr.write("Tests failed\n");
    process.exit(1);
  } else {
    process.exit(0);
  }
}

export async function executeTests(env: Environment, additionalArgs?: {}) {
  const globalConfig = importJsonConfig();

  if (env.foundation.type === "read_only") {
    try {
      if (!process.env.MOON_TEST_ENV) {
        throw new Error("MOON_TEST_ENV not set");
      }

      const ctx = await contextCreator(globalConfig, process.env.MOON_TEST_ENV);
      const chainData = ctx.providers
        .filter((provider) => provider.type == "polkadotJs" && provider.name.includes("para"))
        .map((provider) => {
          return {
            [provider.name]: {
              rtName: (provider.greet() as any).rtName,
              rtVersion: (provider.greet() as any).rtVersion,
            },
          };
        });
      // TODO: Extend/develop this feature to respect para/relay chain specifications
      const { rtVersion, rtName } = Object.values(chainData[0])[0];
      process.env.MOON_RTVERSION = rtVersion;
      process.env.MOON_RTNAME = rtName;
      await ctx.disconnect();
    } catch {
      // No chain to test against
    }
  }

  const options: UserConfig = {
    watch: false,
    globals: true,
    reporters: env.reporters ? env.reporters : ["default"],
    testTimeout: globalConfig.defaultTestTimeout,
    hookTimeout: 500000,
    useAtomics: true,
    passWithNoTests: false,
    isolate: false,
    threads: true,
    minThreads: 1,
    maxThreads: calculateCores(),

    include: env.include ? env.include : ["**/*{test,spec,test_,test-}*{ts,mts,cts}"],
    onConsoleLog(log, type) {
      if (filterList.includes(log.trim())) return false;
      // if (log.trim() == "stdout | unknown test" || log.trim() == "<empty line>") return false;
      if (log.includes("has multiple versions, ensure that there is only one installed.")) {
        return false;
      }
    },
  };

  if (
    !env.multiThreads ||
    process.env.MOON_SINGLE_THREAD === "true" ||
    process.env.MOON_RECYCLE === "true"
  ) {
    options.threads = false;
  }

  if (typeof env.multiThreads === "number") {
    options.minThreads = 1;
    options.maxThreads = Math.floor(env.multiThreads);
  } else if (
    env.multiThreads === "turbo" &&
    process.env.MOON_SINGLE_THREAD !== "true" &&
    process.env.MOON_RECYCLE !== "true"
  ) {
    delete options.threads;
    delete options.isolate;
    options.experimentalVmThreads = true;
    options.experimentalVmWorkerMemoryLimit = 0.75;
  }

  try {
    const folders = env.testFileDir.map((folder) => path.join(".", folder, "/"));
    return await startVitest("test", folders, { ...options, ...additionalArgs });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

const filterList = ["<empty line>", "", "stdout | unknown test"];

const calculateCores = () => {
  const cores = os.cpus().length;
  return Math.max(Math.floor(cores * 0.5), 1);
};
