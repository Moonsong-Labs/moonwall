import type { Environment } from "@moonwall/types";
import chalk from "chalk";
import path from "node:path";
import type { UserConfig, Vitest } from "vitest/node";
import { startVitest } from "vitest/node";
import { createLogger } from "@moonwall/util";
import { clearNodeLogs } from "../internal/cmdFunctions/tempLogs";
import { commonChecks } from "../internal/launcherCommon";
import { cacheConfig, importAsyncConfig, loadEnvVars } from "../lib/configReader";
import { MoonwallContext, contextCreator, runNetworkOnly } from "../lib/globalContext";
const logger = createLogger({ name: "runner" });

export async function testCmd(envName: string, additionalArgs?: testRunArgs): Promise<boolean> {
  await cacheConfig();
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === envName);
  process.env.MOON_TEST_ENV = envName;

  // Set shard information for improved port allocation
  if (additionalArgs?.shard) {
    process.env.MOONWALL_TEST_SHARD = additionalArgs.shard;
  }

  if (!env) {
    const envList = globalConfig.environments
      .map((env) => env.name)
      .sort()
      .join(", ");
    throw new Error(
      `No environment found in config for: ${chalk.bgWhiteBright.blackBright(
        envName
      )}\n Environments defined in config are: ${envList}\n`
    );
  }
  loadEnvVars();

  await commonChecks(env);

  if (
    (env.foundation.type === "dev" && !env.foundation.launchSpec[0].retainAllLogs) ||
    (env.foundation.type === "chopsticks" && !env.foundation.launchSpec[0].retainAllLogs)
  ) {
    clearNodeLogs();
  }

  if (env.foundation.type === "zombie") {
    process.env.MOON_EXIT = "true";
  }

  const vitest = await executeTests(env, additionalArgs);
  const failed = vitest.state
    .getFiles()
    .filter((file) => file.result && file.result.state === "fail");

  if (failed.length === 0) {
    logger.info("✅ All tests passed");
    (global as any).MOONWALL_TERMINATION_REASON = "tests finished";
    return true;
  }
  logger.warn("❌ Some tests failed");
  (global as any).MOONWALL_TERMINATION_REASON = "tests failed";
  return false;
}

export type testRunArgs = {
  testNamePattern?: string;
  subDirectory?: string;
  shard?: string;
  update?: boolean;
  vitestPassthroughArgs?: string[];
};

export async function executeTests(env: Environment, testRunArgs?: testRunArgs & UserConfig) {
  return new Promise<Vitest>(async (resolve, reject) => {
    const globalConfig = await importAsyncConfig();
    if (env.foundation.type === "read_only") {
      try {
        if (!process.env.MOON_TEST_ENV) {
          throw new Error("MOON_TEST_ENV not set");
        }

        const ctx = await contextCreator();
        const chainData = ctx.providers
          .filter((provider) => provider.type === "polkadotJs" && provider.name.includes("para"))
          .map((provider) => {
            return {
              [provider.name]: {
                rtName: (provider.greet() as any).rtName,
                rtVersion: (provider.greet() as any).rtVersion,
              },
            };
          });
        // TODO: Extend/develop this feature to respect para/relay chain specifications
        if (chainData.length < 1) {
          throw "Could not read runtime name or version \nTo fix: ensure moonwall config has a polkadotJs provider with a name containing 'para'";
        }

        const { rtVersion, rtName } = Object.values(chainData[0])[0];
        process.env.MOON_RTVERSION = rtVersion;
        process.env.MOON_RTNAME = rtName;
      } catch (e) {
        logger.error(e);
      } finally {
        await MoonwallContext.destroy();
      }
    }

    const additionalArgs = { ...testRunArgs };

    const vitestOptions = testRunArgs?.vitestPassthroughArgs?.reduce<UserConfig>((acc, arg) => {
      const [key, value] = arg.split("=");
      return {
        // biome-ignore lint/performance/noAccumulatingSpread: this is fine
        ...acc,
        [key]: Number(value) || value,
      };
    }, {});

    // transform  in regexp pattern
    if (env.skipTests && env.skipTests.length > 0) {
      // the final pattern will look like this: "^((?!SO00T02|SM00T01|SM00T03).)*$"
      additionalArgs.testNamePattern = `^((?!${env.skipTests?.map((test) => `${test.name}`).join("|")}).)*$`;
    }

    const options = new VitestOptionsBuilder()
      .setReporters(env.reporters || ["default"])
      .setOutputFile(env.reportFile)
      .setName(env.name)
      .setTimeout(env.timeout || globalConfig.defaultTestTimeout)
      .setInclude(env.include || ["**/*{test,spec,test_,test-}*{ts,mts,cts}"])
      .addThreadConfig(env.multiThreads)
      .addVitestPassthroughArgs(env.vitestArgs)
      .build();

    if (
      globalConfig.environments.find((env) => env.name === process.env.MOON_TEST_ENV)?.foundation
        .type === "zombie"
    ) {
      await runNetworkOnly();
      process.env.MOON_RECYCLE = "true";
    }

    try {
      const testFileDir =
        additionalArgs?.subDirectory !== undefined
          ? env.testFileDir.map((folder) =>
              path.join(folder, additionalArgs.subDirectory || "error")
            )
          : env.testFileDir;

      const folders = testFileDir.map((folder) => path.join(".", folder, "/"));
      const optionsToUse = {
        ...options,
        ...additionalArgs,
        ...vitestOptions,
      } satisfies UserConfig;

      if (env.printVitestOptions) {
        logger.info(`Options to use: ${JSON.stringify(optionsToUse, null, 2)}`);
      }
      resolve((await startVitest("test", folders, optionsToUse)) as Vitest);
    } catch (e) {
      logger.error(e);
      reject(e);
    }
  });
}

const filterList = ["<empty line>", "", "stdout | unknown test"];

class VitestOptionsBuilder {
  private options: UserConfig = {
    watch: false,
    globals: true,
    reporters: ["default"],
    passWithNoTests: false,
    deps: {
      optimizer: { ssr: { enabled: false }, web: { enabled: false } },
    },
    env: {
      NODE_OPTIONS: "--no-warnings --no-deprecation",
    },
    include: ["**/*{test,spec,test_,test-}*{ts,mts,cts}"],

    onConsoleLog(log) {
      if (filterList.includes(log.trim())) return false;
      if (log.includes("has multiple versions, ensure that there is only one installed.")) {
        return false;
      }
    },
  };

  setName(name: string): this {
    this.options.name = name;
    return this;
  }

  setReporters(reporters: string[]): this {
    const modified: (string | [string, any])[] = reporters.includes("basic")
      ? reporters.map((r) =>
          r === "basic" ? (["default", { summary: false }] as [string, any]) : r
        )
      : reporters;

    this.options.reporters = modified;
    return this;
  }

  setOutputFile(
    file?:
      | string
      | {
          [reporterName: string]: string;
        }
  ): this {
    if (!file) {
      logger.info("No output file specified, skipping");
      return this;
    }
    this.options.outputFile = file;
    return this;
  }

  setTimeout(timeout: number): this {
    this.options.testTimeout = timeout;
    this.options.hookTimeout = timeout;
    return this;
  }

  setInclude(include: string[]): this {
    this.options.include = include;
    return this;
  }

  addVitestPassthroughArgs(args?: object): this {
    this.options = { ...this.options, ...args };
    return this;
  }

  addThreadConfig(threads: number | boolean | object = false): this {
    this.options.fileParallelism = false;
    this.options.pool = "forks";
    this.options.poolOptions = {
      forks: {
        isolate: true,
        minForks: 1,
        maxForks: 3,
        singleFork: false,
      },
    };

    if (threads === true && process.env.MOON_RECYCLE !== "true") {
      this.options.fileParallelism = true;
    }

    if (typeof threads === "number" && process.env.MOON_RECYCLE !== "true") {
      this.options.fileParallelism = true;
      if (this.options.poolOptions?.forks) {
        this.options.poolOptions.forks.maxForks = threads;
        this.options.poolOptions.forks.singleFork = false;
      }
    }

    if (typeof threads === "object" && process.env.MOON_RECYCLE !== "true") {
      const key = Object.keys(threads)[0];
      if (["threads", "forks", "vmThreads", "typescript"].includes(key)) {
        this.options.pool = key as "threads" | "forks" | "vmThreads" | "typescript";
        this.options.poolOptions = Object.values(threads)[0];
      } else {
        throw new Error(`Invalid pool type: ${key}`);
      }
    }

    return this;
  }

  build(): UserConfig {
    return this.options;
  }
}
