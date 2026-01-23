import type { Environment } from "../../api/types/index.js";
import chalk from "chalk";
import path from "node:path";
import type { TestUserConfig, Vitest } from "vitest/node";
import { startVitest } from "vitest/node";
import { createLogger } from "../../util/index.js";
import { clearNodeLogs } from "../internal/cmdFunctions/tempLogs.js";
import { commonChecks } from "../internal/launcherCommon.js";
import { cacheConfig, importAsyncConfig, loadEnvVars } from "../lib/configReader.js";
import { MoonwallContext, contextCreator, runNetworkOnly } from "../lib/globalContext.js";
import { shardManager } from "../lib/shardManager.js";
import { findTestFilesMatchingPattern } from "../internal/testIdParser.js";
const logger = createLogger({ name: "runner" });

/**
 * Pre-filters test files by scanning for suite/test IDs matching the pattern.
 * Uses ast-grep's parallel file search for efficient parsing.
 * Returns matching file paths, or undefined if no pattern (let vitest handle all).
 */
async function filterTestFilesByPattern(
  testDirs: string[],
  includePatterns: string[],
  pattern?: string
): Promise<string[] | undefined> {
  if (!pattern) return undefined;

  const patternRegex = new RegExp(pattern, "i");
  const matches = await findTestFilesMatchingPattern(testDirs, includePatterns, patternRegex);

  if (matches.length === 0) {
    throw new Error(
      `No test files found matching pattern "${pattern}". ` +
        `Check that the suite/test ID exists (e.g., D01, D01E01).`
    );
  }
  return matches;
}

export async function testCmd(envName: string, additionalArgs?: testRunArgs): Promise<boolean> {
  await cacheConfig();
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === envName);
  process.env.MOON_TEST_ENV = envName;

  // Initialize sharding configuration
  shardManager.initializeSharding(additionalArgs?.shard);

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

export async function executeTests(env: Environment, testRunArgs?: testRunArgs & TestUserConfig) {
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

    const vitestOptions = testRunArgs?.vitestPassthroughArgs?.reduce<TestUserConfig>((acc, arg) => {
      const [key, value] = arg.split("=");
      return {
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
      .setCacheImports(env.cacheImports)
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
      const includePatterns = env.include || ["**/*{test,spec,test_,test-}*{ts,mts,cts}"];

      // Pre-filter test files by scanning for suite IDs matching the pattern
      // This avoids loading all files in vitest just to discover which ones match
      const filteredFiles = await filterTestFilesByPattern(
        folders,
        includePatterns,
        additionalArgs?.testNamePattern
      );

      const optionsToUse = {
        ...options,
        ...additionalArgs,
        ...vitestOptions,
        ...(filteredFiles ? { include: filteredFiles.map((f) => path.resolve(f)) } : {}),
      } satisfies TestUserConfig;

      if (env.printVitestOptions) {
        logger.info(`Options to use: ${JSON.stringify(optionsToUse, null, 2)}`);
      }

      const foldersToUse = filteredFiles ? ["."] : folders;
      resolve((await startVitest("test", foldersToUse, optionsToUse)) as Vitest);
    } catch (e) {
      logger.error(e);
      reject(e);
    }
  });
}

const filterList = ["<empty line>", "", "stdout | unknown test"];

class VitestOptionsBuilder {
  private options: TestUserConfig = {
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
    // Vitest 4: pool options are now top-level (isolate, maxWorkers)
    this.options.isolate = true;
    this.options.maxWorkers = 3;

    if (threads === true && process.env.MOON_RECYCLE !== "true") {
      this.options.fileParallelism = true;
    }

    if (typeof threads === "number" && process.env.MOON_RECYCLE !== "true") {
      this.options.fileParallelism = true;
      this.options.maxWorkers = threads;
    }

    if (typeof threads === "object" && process.env.MOON_RECYCLE !== "true") {
      // Vitest 4 format: { pool: "forks", maxWorkers: 1, isolate: false, ... }
      const config = threads as {
        pool: string;
        maxWorkers?: number;
        isolate?: boolean;
        memoryLimit?: number;
      };

      if (!["threads", "forks", "vmThreads", "typescript"].includes(config.pool)) {
        throw new Error(`Invalid pool type: ${config.pool}`);
      }

      this.options.fileParallelism = true;
      this.options.pool = config.pool as "threads" | "forks" | "vmThreads" | "typescript";

      if (config.maxWorkers !== undefined) {
        this.options.maxWorkers = config.maxWorkers;
      }
      if (config.isolate !== undefined) {
        this.options.isolate = config.isolate;
      }
      if (config.memoryLimit !== undefined) {
        this.options.vmMemoryLimit = config.memoryLimit;
      }
    }

    return this;
  }

  setCacheImports(enabled?: boolean): this {
    if (enabled) {
      this.options.deps = {
        optimizer: {
          ssr: {
            enabled: true,
            include: ["viem", "ethers"],
          },
          web: { enabled: false },
        },
      };
    }
    return this;
  }

  build(): TestUserConfig {
    return this.options;
  }
}
