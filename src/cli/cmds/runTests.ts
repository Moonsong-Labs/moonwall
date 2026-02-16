import type { Environment } from "../../api/types/index.js";
import chalk from "chalk";
import path from "node:path";
import type { TestUserConfig, Vitest } from "vitest/node";
import { startVitest } from "vitest/node";
import { Effect } from "effect";
import { createLogger } from "../../util/index.js";
import { TestExecutionError } from "../../services/errors.js";
import { clearNodeLogs } from "../internal/cmdFunctions/tempLogs.js";
import { commonChecks } from "../internal/launcherCommon.js";
import { cacheConfig, importAsyncConfig, loadEnvVars } from "../lib/configReader.js";
import { MoonwallContext, contextCreator, runNetworkOnly } from "../lib/globalContext.js";

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

/**
 * Enriches process.env with runtime name/version for read_only environments.
 * Best-effort: warns on failure rather than throwing.
 */
async function enrichReadOnlyContext(): Promise<void> {
  if (!process.env.MOON_TEST_ENV) return;
  let contextCreated = false;
  try {
    const ctx = await contextCreator();
    contextCreated = true;
    const paraProviders = ctx.providers.filter(
      (p) => p.type === "polkadotJs" && p.name.includes("para")
    );
    if (paraProviders.length === 0) {
      logger.warn("No polkadotJs provider with 'para' in name found — skipping runtime enrichment");
      return;
    }
    const greeting = (await paraProviders[0].greet()) as { rtName: string; rtVersion: number };
    process.env.MOON_RTVERSION = String(greeting.rtVersion);
    process.env.MOON_RTNAME = greeting.rtName;
  } catch (e) {
    logger.warn(`Could not read runtime info for read_only env: ${e}`);
  } finally {
    if (contextCreated) {
      await MoonwallContext.destroy();
    }
  }
}

export async function testCmd(envName: string, additionalArgs?: testRunArgs): Promise<boolean> {
  await cacheConfig();
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === envName);
  process.env.MOON_TEST_ENV = envName;

  if (!env) {
    const envList = globalConfig.environments
      .map((env) => env.name)
      .toSorted()
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

  if (env.foundation.type === "read_only") {
    await enrichReadOnlyContext();
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

export function executeTests(
  env: Environment,
  testRunArgs?: testRunArgs & TestUserConfig
): Promise<Vitest> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const globalConfig = yield* Effect.tryPromise({
        try: () => importAsyncConfig(),
        catch: (e) => new TestExecutionError({ cause: e, environment: env.name }),
      });

      const additionalArgs = { ...testRunArgs };

      const vitestOptions = testRunArgs?.vitestPassthroughArgs?.reduce<TestUserConfig>(
        (acc, arg) => {
          const [key, value] = arg.split("=");
          return {
            ...acc,
            [key]: Number(value) || value,
          };
        },
        {}
      );

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
        yield* Effect.tryPromise({
          try: () => runNetworkOnly(),
          catch: (e) => new TestExecutionError({ cause: e, environment: env.name }),
        });
        process.env.MOON_RECYCLE = "true";
      }

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
      const filteredFiles = yield* Effect.tryPromise({
        try: () =>
          filterTestFilesByPattern(folders, includePatterns, additionalArgs?.testNamePattern),
        catch: (e) => new TestExecutionError({ cause: e, environment: env.name }),
      });

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
      const vitest = yield* Effect.tryPromise({
        try: () => startVitest("test", foldersToUse, optionsToUse),
        catch: (e) => new TestExecutionError({ cause: e, environment: env.name }),
      });

      return vitest as Vitest;
    })
  );
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
