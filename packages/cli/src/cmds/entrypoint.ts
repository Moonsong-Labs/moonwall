import { FileSystem, Runtime } from "@effect/platform-node";
import "@moonbeam-network/api-augment";
import dotenv from "dotenv";
import { Effect, pipe } from "effect";
import fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as Err from "../errors";
import { fetchArtifact } from "../internal/cmdFunctions/fetchArtifact";
import { generateConfig } from "../internal/cmdFunctions/initialisation";
import "../internal/logging";
import { debuglogLevel, logLevel } from "../internal/logging";
import { mainCmd } from "./main";
import { runNetworkCmdEffect } from "./runNetwork";
import { testEffect } from "./runTests";

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

type CommandChoices = "undefined" | "init" | "download" | "test" | "run" | "mainmenu";

const processArgs = (args: any): { command: CommandChoices; args?: object } => {
  let commandChosen: CommandChoices = "undefined";
  const argsObject: any = {};

  yargs(hideBin(args))
    .usage("Usage: $0")
    .version("5.0.0.beta")
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
  let commandChosen: CommandChoices;
  let args: any = {};

  const argv = yield* _(parseArgs);
  process.env.MOON_CONFIG_PATH = argv.configFile;

  if (!argv._.length) {
    commandChosen = "mainmenu";
  } else {
    const processedArgs = yield* _(Effect.sync(() => processArgs(process.argv)));
    commandChosen = processedArgs.command;
    args = processedArgs.args;
  }

  switch (commandChosen) {
    case "mainmenu":
      yield* _(mainCmd());
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
          // Effect.tapErrorTag("TestsFailedError", (error) =>
          //   Effect.sync(() =>
          //     console.log(`❌ ${error.fails} test file${error.fails !== 1 ? "s" : ""} failed`)
          //   )
          // )
        )
      );
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

const program: any = pipe(cliStart, Effect.tapErrorCause(Effect.logError));

Runtime.runMain(
  program.pipe(
    Effect.provide(FileSystem.layer),
    Effect.provide(debuglogLevel),
    Effect.provide(logLevel)
  )
);
