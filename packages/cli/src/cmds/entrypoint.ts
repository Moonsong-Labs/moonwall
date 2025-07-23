#!/usr/bin/env -S node --no-warnings --no-deprecation

import "../internal/logging";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { fetchArtifact, deriveTestIds, generateConfig, type fetchArtifactArgs } from "../internal";
import { main } from "./main";
import { runNetworkCmd } from "./runNetwork";
import { testCmd } from "./runTests";
import { configSetup } from "../lib/configReader";
dotenv.config();

function handleCursor() {
  const hideCursor = "\x1B[?25l";
  const showCursor = "\x1B[?25h";

  process.stdout.write(hideCursor);

  process.on("exit", () => {
    process.stdout.write(showCursor);
  });

  process.on("SIGINT", async () => {
    process.stdout.write(showCursor);
    (global as any).MOONWALL_TERMINATION_REASON = "cancelled by user";
    // Import dynamically to avoid circular dependency
    const { MoonwallContext } = await import("../lib/globalContext");
    await MoonwallContext.destroy("cancelled by user");
    process.exit(130); // Standard exit code for SIGINT
  });

  process.on("SIGTERM", async () => {
    process.stdout.write(showCursor);
    (global as any).MOONWALL_TERMINATION_REASON = "terminated by system";
    // Import dynamically to avoid circular dependency
    const { MoonwallContext } = await import("../lib/globalContext");
    await MoonwallContext.destroy("terminated by system");
    process.exit(143); // Standard exit code for SIGTERM
  });
}

handleCursor();

configSetup(process.argv);

export type RunCommandArgs = {
  envName: string;
  GrepTest?: string;
  subDirectory?: string;
};

yargs(hideBin(process.argv))
  .wrap(null)
  .usage("Usage: $0")
  .version("2.0.0")
  .options({
    configFile: {
      type: "string",
      alias: "c",
      description: "path to MoonwallConfig file",
      default: "moonwall.config.json",
    },
  })
  .command(
    "init",
    "Run tests for a given Environment",
    (yargs) =>
      yargs.option("acceptAllDefaults", {
        type: "boolean",
        description: "Accept all defaults",
        alias: "A",
      }),
    async (argv) => {
      await generateConfig(argv);
    }
  )
  .command<fetchArtifactArgs>(
    "download <bin> [ver] [path]",
    "Download x86 artifact from GitHub",
    (yargs) => {
      return yargs
        .positional("bin", {
          describe: "Name of artifact to download\n[ moonbeam | polkadot | *-runtime ]",
          type: "string",
        })
        .positional("ver", {
          describe: "Artifact version to download",
          type: "string",
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
          default: false,
        })
        .option("output-name", {
          describe: "Rename downloaded file to this name",
          alias: "o",
          type: "string",
        });
    },
    async (argv) => {
      await fetchArtifact(argv);
    }
  )
  .command(
    "test <envName> [GrepTest]",
    "Run tests for a given Environment",
    (yargs) => {
      return yargs
        .positional("envName", {
          describe: "Network environment to run tests against",
          array: true,
          string: true,
        })
        .positional("GrepTest", {
          type: "string",
          description: "Pattern to grep test ID/Description to run",
        })
        .option("subDirectory", {
          describe: "Additional sub-directory filter for test suites",
          alias: "d",
          type: "string",
        })
        .option("testShard", {
          describe: "Test Shard info for CI",
          alias: "ts",
          type: "string",
        })
        .option("update", {
          describe: "Update all snapshots",
          alias: "u",
          type: "boolean",
        })
        .option("vitestArgPassthrough", {
          describe: "Arguments to pass directly to Vitest (space-delimited)",
          alias: "vitest",
          type: "string",
        });
    },
    async (args) => {
      if (args.envName) {
        process.env.MOON_RUN_SCRIPTS = "true";
        if (
          !(await testCmd(args.envName.toString(), {
            testNamePattern: args.GrepTest,
            subDirectory: args.subDirectory,
            shard: args.testShard,
            update: args.update,
            vitestPassthroughArgs: args.vitestArgPassthrough?.split(" "),
          }))
        ) {
          process.exitCode = 1;
        }
      } else {
        console.log("❌ No environment specified");
        console.log(`👉 Run 'bun moonwall --help' for more information`);
        process.exitCode = 1;
      }
    }
  )
  .command<RunCommandArgs>(
    "run <envName> [GrepTest]",
    "Start new network found in global config",
    (yargs) => {
      return yargs
        .positional("envName", {
          describe: "Network environment to start",
        })
        .positional("GrepTest", {
          type: "string",
          description: "Pattern to grep test ID/Description to run",
        })
        .option("subDirectory", {
          describe: "Additional sub-directory filter for test suites",
          alias: "d",
          type: "string",
        });
    },
    async (argv) => {
      process.env.MOON_RUN_SCRIPTS = "true";
      await runNetworkCmd(argv);
    }
  )
  .command<{
    suitesRootDir: string;
    prefixPhrase?: string;
    singlePrefix: boolean;
  }>(
    "derive <suitesRootDir>",
    "Derive test IDs based on positional order in the directory tree",
    (yargs) => {
      return yargs
        .positional("suitesRootDir", {
          describe: "Root directory of the suites",
          type: "string",
        })
        .option("prefixPhrase", {
          describe: "Root phrase to generate prefixes from (e.g. DEV)",
          alias: "p",
          type: "string",
        })
        .option("singlePrefix", {
          describe: "Use a single prefix for all suites, instead of deriving from folder names",
          alias: "l",
          default: false,
          type: "boolean",
        });
    },
    async ({ suitesRootDir, prefixPhrase, singlePrefix }) => {
      await deriveTestIds({
        rootDir: suitesRootDir,
        prefixPhrase,
        singlePrefix,
      });
    }
  )
  .demandCommand(1)
  .fail(async (msg) => {
    console.log(msg);
    await main();
  })
  .help("h")
  .alias("h", "help")
  .parseAsync()
  .then(async () => {
    if (process.env.MOON_EXIT) {
      process.exit();
    }
  });
