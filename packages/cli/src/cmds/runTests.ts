import { Environment } from "@moonwall/types";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";
import type { UserConfig } from "vitest";
import { startVitest } from "vitest/node";
import { clearNodeLogs } from "../internal/cmdFunctions/tempLogs";
import { commonChecks } from "../internal/launcherCommon";
import { cacheConfig, importAsyncConfig, loadEnvVars } from "../lib/configReader";
import { contextCreator } from "../lib/globalContext";

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

  const baseOptions = {
    watch: false,
    globals: true,
    reporters: env.reporters ? env.reporters : ["default"],
    outputFile: env.reportFile,
    testTimeout: globalConfig.defaultTestTimeout,
    hookTimeout: 500000,
    passWithNoTests: false,

    include: env.include ? env.include : ["**/*{test,spec,test_,test-}*{ts,mts,cts}"],
    onConsoleLog(log) {
      if (filterList.includes(log.trim())) return false;
      // if (log.trim() == "stdout | unknown test" || log.trim() == "<empty line>") return false;
      if (log.includes("has multiple versions, ensure that there is only one installed.")) {
        return false;
      }
    },
  } satisfies UserConfig;

  // TODO: Create options builder class
  const optionsWithThreads = addThreadConfig(baseOptions, env.multiThreads);
  const options = addGlobalsConfig(optionsWithThreads);

  try {
    const folders = env.testFileDir.map((folder) => path.join(".", folder, "/"));
    return await startVitest("test", folders, { ...options, ...additionalArgs });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

const filterList = ["<empty line>", "", "stdout | unknown test"];

function addThreadConfig(
  config: UserConfig,
  threads: number | boolean | object = false
): UserConfig {
  const configWithThreads = {
    ...config,
    pool: "threads",
    poolOptions: {
      threads: {
        isolate: false,
        minThreads: 1,
        maxThreads: 3,
        singleThread: false,
        useAtomics: false,
      },
    },
  };

  if (
    !threads ||
    process.env.MOON_SINGLE_THREAD === "true" ||
    process.env.MOON_RECYCLE === "true"
  ) {
    configWithThreads.poolOptions.threads = {
      isolate: false,
      minThreads: 1,
      maxThreads: 1,
      singleThread: true,
      useAtomics: false,
    };
  }

  if (typeof threads === "number") {
    config.poolOptions.threads.maxThreads = threads;
  }

  if (typeof threads === "object") {
    configWithThreads.pool = Object.keys(threads)[0];
    configWithThreads.poolOptions = Object.values(threads)[0];
  }

  return configWithThreads;
}
function addGlobalsConfig(config: UserConfig): UserConfig {
  const configWithGlobals = {
    ...config,
  };
  if (process.env.MOON_RECYCLE !== "true") {
    configWithGlobals.globals = true;
    configWithGlobals.setupFiles = [path.resolve(getDirname(), "./internal/multiThreadSetup.js")];
    // configWithGlobals.globalSetup = ["./internal/vitestGlobalsSetup.ts"];
  }

  return configWithGlobals;
}

function getDirname() {
  try {
    return __dirname;
  } catch {
    return path.dirname(fileURLToPath(import.meta.url));
  }
}
