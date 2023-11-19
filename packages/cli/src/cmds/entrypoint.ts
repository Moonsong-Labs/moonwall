import "../internal/logging";
import log from "why-is-node-running";
import "@moonbeam-network/api-augment";
import yargs from "yargs";
import fs from "fs";
import { hideBin } from "yargs/helpers";
import { testEffect } from "./runTests";
import { generateConfig } from "../internal/cmdFunctions/initialisation";
import { fetchArtifact } from "../internal/cmdFunctions/fetchArtifact";
import dotenv from "dotenv";
import { Effect, pipe } from "effect";
import { main } from "./main";
import { runNetworkCmdEffect } from "./runNetwork";
dotenv.config();

const defaultConfigFiles = ["./moonwall.config", "./moonwall.config.json"];

const findExistingConfig = (files: string[]): string | undefined => {
  for (const file of files) {
    if (fs.existsSync(file)) {
      return file;
    }
  }
};

const defaultConfigFile = findExistingConfig(defaultConfigFiles) || "./moonwall.config.json";

const parseConfigFile = Effect.sync(() =>
  yargs(hideBin(process.argv))
    .options({
      configFile: {
        type: "string",
        alias: "c",
        description: "path to MoonwallConfig file",
        default: defaultConfigFile,
      },
    })
    .parseSync()
);

const setEnvVar = (key: string, value: string) =>
  Effect.sync(() => {
    process.env[key] = value;
  });

const setupConfigFileEnv = pipe(
  parseConfigFile,
  Effect.flatMap((parsed) => setEnvVar("MOON_CONFIG_PATH", parsed.configFile))
);

// TODO: REMOVE THIS HACK ONCE YARGS REPLACED
let failedTests: number | false;

const cliStart = Effect.try(() => {
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0")
    .version("2.0.0")
    .options({
      configFile: {
        type: "string",
        alias: "c",
        description: "path to MoonwallConfig file",
        default: defaultConfigFile,
      },
    })
    .parseSync();

  if (!argv._.length) {
    return main();
  }

  return yargs(hideBin(process.argv))
    .usage("Usage: $0")
    .version("2.0.0")
    .options({
      configFile: {
        type: "string",
        alias: "c",
        description: "path to MoonwallConfig file",
        default: defaultConfigFile,
      },
    })
    .command(`init`, "Run tests for a given Environment", async () => {
      const effect = Effect.tryPromise(() => generateConfig());

      await Effect.runPromise(effect);
    })
    .command(
      `download <bin> [ver] [path]`,
      "Download x86 artifact from GitHub",
      (yargs) => {
        return yargs
          .positional("bin", {
            describe: "Name of artifact to download\n[ moonbeam | polkadot | *-runtime ]",
          })
          .positional("ver", {
            describe: "Artifact version to download",
            default: "latest",
          })
          .positional("path", {
            describe: "Path where to save artifacts",
            type: "string",
            default: "./",
          })
          .option("overwrite", {
            describe: "If file exists, should it be overwritten?",
            type: "boolean",
            alias: "d",
            default: true,
          })
          .option("output-name", {
            describe: "Rename downloaded file to this name",
            alias: "o",
            type: "string",
          });
      },
      async (argv) => {
        const effect = Effect.tryPromise(() => fetchArtifact(argv));
        await Effect.runPromise(effect);
      }
    )
    .command(
      `test <envName> [GrepTest]`,
      "Run tests for a given Environment",

      (yargs) =>
        yargs
          .positional("envName", {
            describe: "Network environment to run tests against",
            type: "string",
          })
          .positional("GrepTest", {
            type: "string",
            description: "Pattern to grep test ID/Description to run",
          }),

      async ({ envName, GrepTest }) => {
        process.env.MOON_RUN_SCRIPTS = "true";
        const effect = testEffect(envName, { testNamePattern: GrepTest }).pipe(
          Effect.catchTag("TestsFailedError", (error) => {
            failedTests = error.fails;
            return Effect.succeed(
              console.log(`❌ ${error.fails} test file${error.fails !== 1 ? "s" : ""} failed`)
            );
          })
        );

        await Effect.runPromise(effect);

        if (failedTests) {
          process.exitCode = 1;
        }
        const timeout = 5;
        setTimeout(function () {
          log();
        }, timeout * 1000);
      }
    )
    .command(
      `run <envName> [GrepTest]`,
      "Start new network found in global config",
      (yargs) =>
        yargs
          .positional("envName", {
            describe: "Network environment to start",
          })
          .positional("GrepTest", {
            type: "string",
            description: "Pattern to grep test ID/Description to run",
          }),
      async (argv) => {
        process.env.MOON_RUN_SCRIPTS = "true";
        await Effect.runPromiseExit(runNetworkCmdEffect(argv as any));
      }
    )
    .help("h")
    .alias("h", "help")
    .parse();
});

const cli = pipe(
  setupConfigFileEnv,
  Effect.flatMap(() => cliStart)
);

Effect.runPromise(cli)
  .then(() => {
    console.log("🏁 Moonwall Test Run finished");
    process.exit();
  })
  .catch(console.error);
