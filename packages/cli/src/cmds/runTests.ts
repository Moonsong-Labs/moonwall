import { Environment } from "@moonwall/types";
import chalk from "chalk";
import os from "node:os";
import path from "path";
import type { UserConfig } from "vitest";
import { startVitest } from "vitest/node";
import { clearNodeLogs } from "../internal/cmdFunctions/tempLogs";
import { cacheConfig, loadEnvVars, importAsyncConfig } from "../lib/configReader";
import { contextCreator } from "../lib/globalContext";
import { commonChecks } from "../internal/launcherCommon";

export async function testCmd(envName: string, additionalArgs?: object) {
  await cacheConfig();
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === envName)!;
  process.env.MOON_TEST_ENV = envName;

  if (!env) {
    const envList = globalConfig.environments.map((env) => env.name);
    throw new Error(
      `No environment found in config for: ${chalk.bgWhiteBright.blackBright(
        envName
      )}\n Environments defined in config are: ${envList}\n`
    );
  }
  loadEnvVars();

  await commonChecks(env);

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

export async function executeTests(env: Environment, additionalArgs?: object) {
  const globalConfig = await importAsyncConfig();
  if (env.foundation.type === "read_only") {
    try {
      if (!process.env.MOON_TEST_ENV) {
        throw new Error("MOON_TEST_ENV not set");
      }

      const ctx = await contextCreator();
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
    onConsoleLog(log) {
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
    console.log("hello");
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
