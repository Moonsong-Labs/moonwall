import { Environment } from "@moonwall/types";
import { Config, Effect, Ref, pipe } from "effect";
import path from "path";
import type { UserConfig } from "vitest";
import { startVitest } from "vitest/node";
import * as Err from "../errors";
import { clearNodeLogs } from "../internal/cmdFunctions/tempLogs";
import { getCurrentDirectoryName } from "../internal/fileCheckers";
import { commonChecks } from "../internal/launcherCommon";
import { importMoonwallConfig, loadEnvVars } from "../lib/configReader";
import {
  MoonwallContext,
  createContextEffect,
  runNetworkOnlyEffect,
} from "../lib/globalContextEffect";
import { ServiceState, nodePool, nodePoolClientSend } from "../internal/nodePool";

export const testEffect = (envName: string, additionalArgs?: object) =>
  Effect.scoped(
    Effect.gen(function* (_) {
      const globalConfig = yield* _(importMoonwallConfig());
      const env = yield* _(
        Effect.filterOrFail(
          Effect.sync(() => globalConfig.environments.find(({ name }) => name === envName)),
          (env) => !!env,
          () => new Err.EnvironmentMissingError({ env: envName })
        )
      );

      const serviceState = yield* _(
        Ref.make<ServiceState>({
          rpcServers: [],
          maxServers: 10,
          socketPath: path.join(process.cwd(), "tmp", "nodepool-ipc.sock"),
        })
      );

      yield* _(Effect.sync(() => (process.env.MOON_TEST_ENV = envName)));
      yield* _(Effect.sync(() => loadEnvVars()));
      yield* _(commonChecks(env));
      yield* _(nodePool(serviceState));

      const state = yield* _(Ref.get(serviceState));

      // NodeService Testing
      console.log("state before")
      console.log(yield* _(Ref.get(serviceState)))
      
      const response = yield* _(
        nodePoolClientSend({ cmd: "ping", id: 1, text: "ping" }, state.socketPath)
      );
      console.log(`response: ${JSON.stringify(response)}`);
      console.log(yield* _(Ref.get(serviceState)))
      const response2 = yield* _(
        nodePoolClientSend(
          {
            cmd: "provision",
            id: 1,
            text: "can i have a node",
          },
          state.socketPath
        )
      );


      console.log(`response2: ${JSON.stringify(response2)}`);
      yield* _(Effect.sleep(5000));
      console.log("state after")
      console.log(yield* _(Ref.get(serviceState)))
      if (
        (env.foundation.type == "dev" && !env.foundation.launchSpec[0].retainAllLogs) ||
        (env.foundation.type == "chopsticks" && !env.foundation.launchSpec[0].retainAllLogs)
      ) {
        yield* _(Effect.sync(() => clearNodeLogs()));
      }

      yield* _(Effect.logInfo(`Running tests for ${envName}`));

      // TODO: RE-ENABLE THIS

      // const vitest = yield* _(executeTestEffect(env, additionalArgs));
      // const failed = yield* _(
      //   Effect.sync(() => vitest!.state.getFiles().filter((file) => file.result!.state === "fail"))
      // );

      // if (failed.length !== 0) {
      //   yield* _(new Err.TestsFailedError({ fails: failed.length }));
      // }
    })
  );

export const executeTestEffect = (env: Environment, additionalArgs?: object) => {
  return Effect.gen(function* (_) {
    const globalConfig = yield* _(importMoonwallConfig());

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

      const { rtVersion, rtName }: any = yield* _(
        Effect.sync(() => Object.values(chainData[0])[0])
      );
      process.env.MOON_RTVERSION = rtVersion;
      process.env.MOON_RTNAME = rtName;

      yield* _(
        Effect.try({
          try: () => MoonwallContext.destroy(),
          catch: () => new Err.MoonwallContextError(),
        })
      );
    }

    const envPath = path.join(getCurrentDirectoryName(), "internal", "vitest", "environment.js");

    const baseOptions = {
      watch: false,
      globals: true,
      reporters: env.reporters ? env.reporters : ["default"],
      outputFile: env.reportFile,
      setupFiles: envPath,
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
      Effect.promise(() => startVitest("test", folders, { ...options, ...additionalArgs }))
    );
  });
};

const filterList = ["<empty line>", "", "stdout | unknown test"];

function addThreadConfig(
  config: UserConfig,
  threads: number | boolean | object = false
): UserConfig {
  let configWithThreads: UserConfig = {
    ...config,
    minThreads: 1,
    maxThreads: 1,
    singleThread: true,
    useAtomics: false,
    isolate: true,
    // pool: "threads",
    // poolOptions: {
    //   threads: {
    //     isolate: true,
    //     minThreads: 1,
    //     maxThreads: 1,
    //     singleThread: true,
    //     useAtomics: false,
    //   },
    // },
  };

  if (threads == true && process.env.MOON_RECYCLE !== "true") {
    configWithThreads = {
      ...configWithThreads,
      isolate: true,
      minThreads: 1,
      maxThreads: 4,
      singleThread: false,
      useAtomics: false,
    };
    // configWithThreads.poolOptions.threads = {
    //   isolate: true,
    //   minThreads: 1,
    //   maxThreads: 3,
    //   singleThread: false,
    //   useAtomics: false,
    // };
  }

  if (typeof threads === "number") {
    configWithThreads = {
      ...configWithThreads,
      isolate: true,
      minThreads: 1,
      maxThreads: threads,
      singleThread: false,
      useAtomics: false,
    };
    // configWithThreads.poolOptions.threads.maxThreads = threads;
    // configWithThreads.poolOptions.threads.singleThread = false;
  }

  if (typeof threads === "object") {
    throw new Error("Not implemented (Rolled back vitest version)");
    // const key = Object.keys(threads)[0];
    // if (["threads", "forks", "vmThreads", "typescript"].includes(key)) {
    //   configWithThreads.pool = key as "threads" | "forks" | "vmThreads" | "typescript";
    //   configWithThreads.poolOptions = Object.values(threads)[0];
    // } else {
    //   throw new Error(`Invalid pool type: ${key}`);
    // }
  }
  return configWithThreads;
}
