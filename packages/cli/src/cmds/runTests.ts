import type { Environment, } from "@moonwall/types";
import { Effect, } from "effect";
import chalk from "chalk";
import path from "node:path";
import { createLogger } from "@moonwall/util";
import { clearNodeLogs } from "../internal/cmdFunctions/tempLogs";
import { commonChecks } from "../internal/launcherCommon";
import { cacheConfig, importAsyncConfig, loadEnvVars } from "../lib/configReader";
import { MoonwallContext, contextCreator, runNetworkOnly } from "../lib/globalContext";
import { shardManager } from "../lib/shardManager";
import { findTestFilesMatchingPattern } from "../internal/testIdParser";
import {
  ConfigService,
} from "../internal/effect/services/ConfigService.js";
import { ConfigServiceLive } from "../internal/effect/services/ConfigServiceLive.js";
import { TestCommandError, formatCliError } from "./runTestsEffect.js";

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
  // Use Effect for configuration loading with structured error handling
  const loadConfigEffect = Effect.gen(function* () {
    const configService = yield* ConfigService;

    // Load configuration
    const config = yield* configService.loadConfig();

    // Get the specific environment
    const env = yield* configService.getEnvironment(envName).pipe(
      Effect.catchTag("EnvironmentNotFoundError", (error) => {
        const envList = error.availableEnvironments
          ? [...error.availableEnvironments].sort().join(", ")
          : "none";
        return Effect.fail(
          new TestCommandError({
            message: `No environment found in config for: ${chalk.bgWhiteBright.blackBright(
              envName
            )}\n Environments defined in config are: ${envList}\n`,
            environmentName: envName,
          })
        );
      })
    );

    return { config, env };
  }).pipe(Effect.provide(ConfigServiceLive));

  // Run the Effect at the boundary and handle errors
  const configResult = await Effect.runPromise(
    loadConfigEffect.pipe(
      Effect.catchAll((error) => {
        // Convert Effect errors to thrown exceptions for backwards compatibility
        const message = formatCliError(error);
        return Effect.fail(new Error(message));
      })
    )
  ).catch((error) => {
    throw error;
  });

  const { env } = configResult;
  process.env.MOON_TEST_ENV = envName;

  // Initialize sharding configuration
  shardManager.initializeSharding(additionalArgs?.shard);

  // Also cache config for other parts of the system that use the old API
  await cacheConfig();
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

  const result = await executeTests(env, additionalArgs);

  if (result.success) {
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
  /** Suppress test runner output to console */
  silent?: boolean;
  /** @deprecated Use bunTestPassthroughArgs instead */
  vitestPassthroughArgs?: string[];
  bunTestPassthroughArgs?: string[];
  /** Callback for streaming test output lines (alternative to silent mode) */
  onOutputLine?: (line: string) => void;
};

/** Result of a Bun test runner execution */
export type BunTestResult = {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function executeTests(
  env: Environment,
  testRunArgs?: testRunArgs
): Promise<BunTestResult> {
  const globalConfig = await importAsyncConfig();

  // Handle read_only foundation: extract runtime version/name before running tests
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

  // Transform skipTests into a negative lookahead regex pattern
  // The final pattern will look like: "^((?!SO00T02|SM00T01|SM00T03).)*$"
  if (env.skipTests && env.skipTests.length > 0) {
    additionalArgs.testNamePattern = `^((?!${env.skipTests?.map((test) => `${test.name}`).join("|")}).)*$`;
  }

  // Build Bun test options
  const options = new BunTestOptionsBuilder()
    .setTimeout(env.timeout || globalConfig.defaultTestTimeout)
    .setReporter(env.reporters?.[0])
    .setOutputFile(env.reportFile)
    .setTestNamePattern(additionalArgs.testNamePattern)
    .setMaxConcurrency(env.maxConcurrency)
    .addPassthroughArgs(env.bunTestArgs)
    .build();

  // Handle zombie foundation: start network first
  if (
    globalConfig.environments.find((env) => env.name === process.env.MOON_TEST_ENV)?.foundation
      .type === "zombie"
  ) {
    await runNetworkOnly();
    process.env.MOON_RECYCLE = "true";
  }

  // Determine test directories
  const testFileDir =
    additionalArgs?.subDirectory !== undefined
      ? env.testFileDir.map((folder) => path.join(folder, additionalArgs.subDirectory || "error"))
      : env.testFileDir;

  const folders = testFileDir.map((folder) => path.join(".", folder, "/"));
  const includePatterns = env.include || ["**/*{test,spec,test_,test-}*{ts,mts,cts}"];

  // Pre-filter test files by scanning for suite IDs matching the pattern
  // This avoids loading all files just to discover which ones match
  const filteredFiles = await filterTestFilesByPattern(
    folders,
    includePatterns,
    additionalArgs?.testNamePattern
  );

  // Build the final CLI args
  const cliArgs = options.toCliArgs();

  // Merge passthrough args (support both legacy vitestPassthroughArgs and new bunTestPassthroughArgs)
  const passthroughArgs = testRunArgs?.bunTestPassthroughArgs || testRunArgs?.vitestPassthroughArgs;
  if (passthroughArgs) {
    cliArgs.push(...passthroughArgs);
  }

  // Add test files/directories as positional arguments
  const testTargets = filteredFiles ? filteredFiles.map((f) => path.resolve(f)) : folders;
  cliArgs.push(...testTargets);

  if (env.printTestRunnerOptions) {
    logger.info(`Bun test args: bun test ${cliArgs.join(" ")}`);
  }

  // Execute tests using Bun.spawn
  return runBunTests(cliArgs, {
    silent: testRunArgs?.silent,
    onOutputLine: testRunArgs?.onOutputLine,
  });
}

type RunBunTestsOptions = {
  silent?: boolean;
  onOutputLine?: (line: string) => void;
};

/**
 * Executes `bun test` with the given CLI arguments and returns the result.
 */
async function runBunTests(
  args: string[],
  options: RunBunTestsOptions = {}
): Promise<BunTestResult> {
  const proc = Bun.spawn(["bun", "test", ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_OPTIONS: "--no-warnings --no-deprecation",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  // Handle output based on options
  if (options.onOutputLine) {
    // Stream output line by line to callback
    for (const line of stdout.split("\n")) {
      if (line) options.onOutputLine(line);
    }
    for (const line of stderr.split("\n")) {
      if (line) options.onOutputLine(line);
    }
  } else if (!options.silent) {
    // Default: write to console
    if (stdout) {
      process.stdout.write(stdout);
    }
    if (stderr) {
      process.stderr.write(stderr);
    }
  }

  return {
    success: exitCode === 0,
    exitCode,
    stdout,
    stderr,
  };
}

/** Options for configuring Bun test runner execution */
type BunTestOptions = {
  timeout?: number;
  reporter?: "junit" | "dots";
  reporterOutfile?: string;
  testNamePattern?: string;
  coverage?: boolean;
  maxConcurrency?: number;
  bail?: number;
  updateSnapshots?: boolean;
  passWithNoTests?: boolean;
  passthroughArgs?: string[];
};

/**
 * Builder for Bun test runner CLI arguments.
 * Maps moonwall environment config to `bun test` CLI flags.
 */
class BunTestOptionsBuilder {
  private options: BunTestOptions = {
    passWithNoTests: false,
  };

  setTimeout(timeout: number): this {
    this.options.timeout = timeout;
    return this;
  }

  setReporter(reporter?: string): this {
    // Bun supports: 'junit', 'dots', or default (console output)
    // Map vitest reporters to Bun equivalents where possible
    if (reporter === "junit") {
      this.options.reporter = "junit";
    } else if (reporter === "dots" || reporter === "basic") {
      this.options.reporter = "dots";
    }
    // 'default' and others use Bun's default console output
    return this;
  }

  setOutputFile(file?: string | Record<string, string>): this {
    if (!file) {
      return this;
    }
    // Handle both string and object formats
    const outfile = typeof file === "string" ? file : Object.values(file)[0];
    this.options.reporterOutfile = outfile;
    return this;
  }

  setTestNamePattern(pattern?: string): this {
    if (pattern) {
      this.options.testNamePattern = pattern;
    }
    return this;
  }

  setCoverage(enabled?: boolean): this {
    if (enabled) {
      this.options.coverage = true;
    }
    return this;
  }

  setMaxConcurrency(threads?: number | boolean | object): this {
    // Bun uses --max-concurrency for controlling parallel test execution
    // Default is 20, but we limit when running against shared network
    if (process.env.MOON_RECYCLE === "true") {
      // Running against zombie network - disable parallelism
      this.options.maxConcurrency = 1;
      return this;
    }

    if (typeof threads === "number") {
      this.options.maxConcurrency = threads;
    } else if (threads === true) {
      // Let Bun use its default (20)
    } else if (threads === false) {
      this.options.maxConcurrency = 1;
    }
    // Object config (pool options) not directly supported by Bun, ignore
    return this;
  }

  setBail(count?: number): this {
    if (count !== undefined) {
      this.options.bail = count;
    }
    return this;
  }

  setUpdateSnapshots(update?: boolean): this {
    if (update) {
      this.options.updateSnapshots = true;
    }
    return this;
  }

  addPassthroughArgs(args?: Record<string, any>): this {
    if (!args) return this;

    // Convert object args to CLI flags
    const cliArgs: string[] = [];
    for (const [key, value] of Object.entries(args)) {
      if (value === true) {
        cliArgs.push(`--${key}`);
      } else if (value !== false && value !== undefined) {
        cliArgs.push(`--${key}=${value}`);
      }
    }
    this.options.passthroughArgs = cliArgs;
    return this;
  }

  build(): BunTestOptionsBuilder {
    return this;
  }

  /**
   * Converts the options to CLI arguments for `bun test`
   */
  toCliArgs(): string[] {
    const args: string[] = [];

    if (this.options.timeout !== undefined) {
      args.push(`--timeout=${this.options.timeout}`);
    }

    if (this.options.reporter) {
      args.push(`--reporter=${this.options.reporter}`);
    }

    if (this.options.reporterOutfile) {
      args.push(`--reporter-outfile=${this.options.reporterOutfile}`);
    }

    if (this.options.testNamePattern) {
      args.push(`--test-name-pattern=${this.options.testNamePattern}`);
    }

    if (this.options.coverage) {
      args.push("--coverage");
    }

    if (this.options.maxConcurrency !== undefined) {
      args.push(`--max-concurrency=${this.options.maxConcurrency}`);
    }

    if (this.options.bail !== undefined) {
      args.push(`--bail=${this.options.bail}`);
    }

    if (this.options.updateSnapshots) {
      args.push("--update-snapshots");
    }

    if (this.options.passWithNoTests) {
      args.push("--pass-with-no-tests");
    }

    // Add passthrough args
    if (this.options.passthroughArgs) {
      args.push(...this.options.passthroughArgs);
    }

    return args;
  }
}
