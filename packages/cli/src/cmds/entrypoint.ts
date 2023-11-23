import "../internal/logging";
import "@moonbeam-network/api-augment";
import { Runtime } from "@effect/platform-node";
import yargs from "yargs";
import fs from "fs";
import { hideBin } from "yargs/helpers";
import { testEffect } from "./runTests";
import { generateConfig } from "../internal/cmdFunctions/initialisation";
import { fetchArtifact } from "../internal/cmdFunctions/fetchArtifact";
import dotenv from "dotenv";
import { Effect, pipe } from "effect";
import * as Err from "../errors";
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

const parseArgs = Effect.sync(() =>
  yargs(hideBin(process.argv))
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
    .parseSync()
);

const setEnvVar = (key: string, value: string) =>
  Effect.sync(() => {
    process.env[key] = value;
  });

const setupConfigFileEnv = pipe(
  parseArgs,
  Effect.flatMap((parsed) => setEnvVar("MOON_CONFIG_PATH", parsed.configFile))
);

const processArgs = (args: any): { command: string; args?: object } => {
  let commandChosen: string;
  const argsObject: object = {};

  yargs(hideBin(args))
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
      commandChosen = "init";
    })
    .command(
      `download <bin> [ver] [path]`,
      "Download x86 artifact from GitHub",
      (yargs) =>
        yargs
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
          }),
      async (argv) => {
        commandChosen = "download";
        argsObject["argv"] = argv;
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
        argsObject["envName"] = envName;
        argsObject["GrepTest"] = GrepTest;
        commandChosen = "test";
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
        argsObject["argv"] = argv;
        commandChosen = "run";
      }
    )
    .help("h")
    .alias("h", "help")
    .parse();

  return { command: commandChosen, args: argsObject };
};

const cliStart = Effect.gen(function* (_) {
  let commandChosen: string;
  let args: object = {};
  let failedTests: number | false;

  const argv = yield* _(parseArgs);

  if (!argv._.length) {
    commandChosen = "mainmenu";
  } else {
    const processedArgs = yield* _(Effect.sync(() => processArgs(process.argv)));
    commandChosen = processedArgs.command;
    args = processedArgs.args;
  }

  switch (commandChosen) {
    case "mainmenu":
      yield* _(Effect.promise(main));
      break;

    case "init":
      yield* _(Effect.tryPromise(() => generateConfig()));
      break;

    case "download":
      yield* _(Effect.tryPromise(() => fetchArtifact(args["argv"])));
      break;

    case "test": {
      yield* _(
        testEffect(args["envName"], { testNamePattern: args["GrepTest"] }).pipe(
          Effect.tap(() => Effect.sync(() => console.log("✅  All Tests Passed"))),
          Effect.catchTag("TestsFailedError", (error) => {
            failedTests = error.fails;
            return Effect.succeed(
              console.log(`❌ ${error.fails} test file${error.fails !== 1 ? "s" : ""} failed`)
            );
          })
        )
      );

      if (failedTests) {
        process.exitCode = 1;
      }

      break;
    }

    case "run":
      yield* _(runNetworkCmdEffect(args["argv"]));
      break;

    default:
      yield* _(new Err.InvalidCommandError({ command: commandChosen }));
      break;
  }

  console.log("🏁 Moonwall Process finished");
});

const program = pipe(
  setupConfigFileEnv,
  Effect.flatMap(() => cliStart)
);

Runtime.runMain(program);
