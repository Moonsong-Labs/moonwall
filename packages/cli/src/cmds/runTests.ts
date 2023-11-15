import { Environment } from "@moonwall/types";
import chalk from "chalk";
import path from "path";
import { Effect, Config } from "effect";
import type { UserConfig, Vitest } from "vitest";
import { startVitest } from "vitest/node";
import { clearNodeLogs } from "../internal/cmdFunctions/tempLogs";
import { commonChecks } from "../internal/launcherCommon";
import { cacheConfig, importAsyncConfig, loadEnvVars } from "../lib/configReader";
import * as Err from "../errors";
import {
  MoonwallContext,
  createContextEffect,
  runNetworkOnlyEffect,
} from "../lib/globalContextEffect";
import {
  MoonwallContext as legacyMoonwallContext,
  runNetworkOnly as legacyRunNetworkOnly,
  contextCreator,
} from "../lib/globalContext";

export const testEffect = (envName: string, additionalArgs?: object) => {
  return Effect.gen(function* (_) {
    yield* _(
      Effect.tryPromise({
        try: () => cacheConfig(),
        catch: () => new Err.ConfigError(),
      })
    );
    const globalConfig = yield* _(
      Effect.tryPromise({
        try: () => importAsyncConfig(),
        catch: () => new Err.ConfigError(),
      })
    );

    const env = yield* _(
      Effect.filterOrFail(
        Effect.sync(() => globalConfig.environments.find(({ name }) => name === envName)),
        (env) => !!env,
        () => new Err.EnvironmentMissingError(envName)
      )
    );

    yield* _(Effect.sync(() => (process.env.MOON_TEST_ENV = envName)));
    yield* _(Effect.sync(() => loadEnvVars()));

    yield* _(
      Effect.tryPromise({
        try: () => commonChecks(env),
        catch: () => new Err.CommonCheckError(),
      })
    );

    if (
      (env.foundation.type == "dev" && !env.foundation.launchSpec[0].retainAllLogs) ||
      (env.foundation.type == "chopsticks" && !env.foundation.launchSpec[0].retainAllLogs)
    ) {
      yield* _(Effect.sync(() => clearNodeLogs()));
    }
    const vitest = yield* _(executeTestEffect(env, additionalArgs));
    const failed = yield* _(
      Effect.sync(() => vitest!.state.getFiles().filter((file) => file.result!.state === "fail"))
    );

    if (failed.length === 0) {
      yield* _(Effect.sync(() => console.log("✅ All tests passed")));
      return;
    } else {
      yield* _(Effect.fail(new Err.TestsFailedError(failed.length)));
    }
  });
};

export async function testCmd(envName: string, additionalArgs?: object): Promise<boolean> {
  await cacheConfig();
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === envName)!;
  process.env.MOON_TEST_ENV = envName;

  if (!env) {
    const envList = globalConfig.environments.map((env) => env.name);
    new Error(
      `No environment found in config for: ${chalk.bgWhiteBright.blackBright(
        envName
      )}\n Environments defined in config are: ${envList}\n`
    );
  }
  loadEnvVars();

  await commonChecks(env);

  if (
    (env.foundation.type == "dev" && !env.foundation.launchSpec[0].retainAllLogs) ||
    (env.foundation.type == "chopsticks" && !env.foundation.launchSpec[0].retainAllLogs)
  ) {
    clearNodeLogs();
  }
  const vitest = await executeTests(env, additionalArgs);
  const failed = vitest!.state.getFiles().filter((file) => file.result!.state === "fail");

  if (failed.length === 0) {
    console.log("✅ All tests passed");
    return true;
  } else {
    console.log("❌ Some tests failed");
    return false;
  }
}

export const executeTestEffect = (env: Environment, additionalArgs?: object) => {
  return Effect.gen(function* (_) {
    const globalConfig = yield* _(
      Effect.tryPromise({
        try: () => importAsyncConfig(),
        catch: () => new Err.ConfigError(),
      })
    );

    if (
      env.foundation.type === "read_only" &&
      env.foundation.launchSpec.disableRuntimeVersionCheck !== true
    ) {
      yield* _(Effect.config(Config.string("MOON_TEST_ENV")));

      const ctx = yield* _(createContextEffect());

      const chainData = yield* _(
        Effect.filterOrFail(
          Effect.sync(() =>
            ctx.providers
              .filter((provider) => provider.type == "polkadotJs" && provider.name.includes("para"))
              .map((provider) => {
                return {
                  [provider.name]: {
                    rtName: (provider.greet() as any).rtName,
                    rtVersion: (provider.greet() as any).rtVersion,
                  },
                };
              })
          ),
          (data) => data.length > 0,
          () =>
            new Err.ConfigError(
              "No polkadotJs provider named 'para' found (this is required for read_only foundations)"
            )
        )
      );

      const { rtVersion, rtName } = yield* _(Effect.sync(() => Object.values(chainData[0])[0]));
      process.env.MOON_RTVERSION = rtVersion;
      process.env.MOON_RTNAME = rtName;

      yield* _(
        Effect.try({
          try: () => MoonwallContext.destroyEffect(),
          catch: () => new Err.MoonwallContextError(),
        })
      );
    }

    const baseOptions = {
      watch: false,
      globals: true,
      reporters: env.reporters ? env.reporters : ["default"],
      outputFile: env.reportFile,
      testTimeout: env.timeout || globalConfig.defaultTestTimeout,
      hookTimeout: env.timeout || globalConfig.defaultTestTimeout,
      passWithNoTests: false,
      deps: {
        optimizer: { ssr: { enabled: false }, web: { enabled: false } },
      },
      include: env.include ? env.include : ["**/*{test,spec,test_,test-}*{ts,mts,cts}"],
      onConsoleLog(log) {
        if (filterList.includes(log.trim())) return false;
        // if (log.trim() == "stdout | unknown test" || log.trim() == "<empty line>") return false;
        if (log.includes("has multiple versions, ensure that there is only one installed.")) {
          return false;
        }
      },
    } satisfies UserConfig;

    const options = yield* _(
      Effect.try({
        try: () => addThreadConfig(baseOptions, env.multiThreads),
        catch: () => new Err.ConfigError(),
      })
    );

    if (
      globalConfig.environments.find((env) => env.name === process.env.MOON_TEST_ENV).foundation
        .type == "zombie"
    ) {
      yield* _(runNetworkOnlyEffect());
      process.env.MOON_RECYCLE = "true";
    }

    const folders = env.testFileDir.map((folder) => path.join(".", folder, "/"));

    return yield* _(
      Effect.tryPromise({
        try: () => startVitest("test", folders, { ...options, ...additionalArgs }),
        catch: (e: any) => new Error(e.message),
      })
    );
  });
};

export async function executeTests(env: Environment, additionalArgs?: object) {
  return new Promise<Vitest>(async (resolve, reject) => {
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
        await legacyMoonwallContext.destroy();
      } catch {
        // No chain to test against
      }
    }

    const baseOptions = {
      watch: false,
      globals: true,
      reporters: env.reporters ? env.reporters : ["default"],
      outputFile: env.reportFile,
      testTimeout: env.timeout || globalConfig.defaultTestTimeout,
      hookTimeout: env.timeout || globalConfig.defaultTestTimeout,
      passWithNoTests: false,
      deps: {
        optimizer: { ssr: { enabled: false }, web: { enabled: false } },
      },
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
    const options = addThreadConfig(baseOptions, env.multiThreads);

    if (
      globalConfig.environments.find((env) => env.name === process.env.MOON_TEST_ENV)?.foundation
        .type == "zombie"
    ) {
      await legacyRunNetworkOnly();
      process.env.MOON_RECYCLE = "true";
    }

    try {
      const folders = env.testFileDir.map((folder) => path.join(".", folder, "/"));
      resolve(await startVitest("test", folders, { ...options, ...additionalArgs }));
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

const filterList = ["<empty line>", "", "stdout | unknown test"];

function addThreadConfig(
  config: UserConfig,
  threads: number | boolean | object = false
): UserConfig {
  const configWithThreads: UserConfig = {
    ...config,
    pool: "threads",
    poolOptions: {
      threads: {
        isolate: true,
        minThreads: 1,
        maxThreads: 1,
        singleThread: true,
        useAtomics: false,
      },
    },
  };

  if (threads == true && process.env.MOON_RECYCLE !== "true") {
    configWithThreads.poolOptions.threads = {
      isolate: true,
      minThreads: 1,
      maxThreads: 3,
      singleThread: false,
      useAtomics: false,
    };
  }

  if (typeof threads === "number") {
    configWithThreads.poolOptions.threads.maxThreads = threads;
    configWithThreads.poolOptions.threads.singleThread = false;
  }

  if (typeof threads === "object") {
    const key = Object.keys(threads)[0];
    if (["threads", "forks", "vmThreads", "typescript"].includes(key)) {
      configWithThreads.pool = key as "threads" | "forks" | "vmThreads" | "typescript";
      configWithThreads.poolOptions = Object.values(threads)[0];
    } else {
      throw new Error(`Invalid pool type: ${key}`);
    }
  }
  return configWithThreads;
}
