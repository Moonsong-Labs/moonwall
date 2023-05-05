import { importJsonConfig } from "../lib/configReader.js";
import { startVitest } from "vitest/node";
import { UserConfig } from "vitest";
import { contextCreator } from "../lib/globalContext.js";
import { Environment } from "../types/config.js";
import fs from "node:fs";
import path from "path";
import chalk from "chalk";

export async function testCmd(envName: string, additionalArgs?: {}) {
  const globalConfig = await importJsonConfig();

  const env = globalConfig.environments.find(({ name }) => name === envName)!;

  if (!!!env) {
    const envList = globalConfig.environments.map((env) => env.name);
    throw new Error(
      `No environment found in config for: ${chalk.bgWhiteBright.blackBright(
        envName
      )}\n Environments defined in config are: ${envList}\n`
    );
  }

  process.env.MOON_TEST_ENV = envName;

  const vitest = await executeTests(env, additionalArgs);
  const failed = vitest.state.getFiles().filter((file) => file.result.state === "fail");

  if (failed.length > 0) {
    process.stderr.write("Tests failed\n");
    process.exit(1);
  } else {
    process.exit(0);
  }
}

export async function executeTests(env: Environment, additionalArgs?: {}) {
  const globalConfig = await importJsonConfig();

  if (env.foundation.type === "read_only") {
    try {
      const ctx = await contextCreator(globalConfig, process.env.MOON_TEST_ENV);
      const chainData = ctx.providers
        .filter((provider) => provider.type == "moon" || provider.type == "polkadotJs")
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
    reporters: env.html ? ["verbose", "html"] : ["verbose"],
    testTimeout: 10000,
    hookTimeout: 500000,
    useAtomics: true,
    passWithNoTests: false,
    threads: true,
    include: env.include ? env.include : ["**/{test,spec,test_,test-}*{ts,mts,cts}"],
    onConsoleLog(log, type) {
      if (log.trim() == "" || log.trim() == "<empty line>") return false;
    },
  };

  if (!env.multiThreads || process.env.MOON_SINGLE_THREAD === "true") {
    // process.env.MOON_RECYCLE = "true";
    options.useAtomics = false;
    options.threads = false;
  }

  try {
    const folders = env.testFileDir.map((folder) => path.join("/", folder, "/"));
    return await startVitest("test", folders, { ...options, ...additionalArgs });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
