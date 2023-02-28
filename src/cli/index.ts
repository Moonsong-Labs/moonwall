#!/usr/bin/env ts-node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { testCmd } from "./cmds/runTests.js";
import { runNetwork } from "./cmds/runNetwork.js";
import { generateConfig } from "./cmds/generateConfig.js";
import { main } from "./cmds/main.js";
import { downloader } from "./cmds/downloader.js";

yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .version("2.0.0")
  .command(`init`, "Run tests for a given Environment", async () => {
    await generateConfig();
  })
  .command(
    `download <artifact> [bin-version] [path]`,
    "Download a published x86 artifact from GitHub",
    (yargs) => {
      return yargs
        .positional("artifact", {
          describe:
            "Name of artifact to download\n[ moonbeam | polkadot | *-runtime ]",
        })
        .positional("bin-version", {
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
      await downloader(argv as any);
    }
  )
  .command(
    `test <envName>`,
    "Run tests for a given Environment",
    (yargs) => {
      return yargs.positional("envName", {
        describe: "Network environment to run tests against",
      });
    },
    async (argv) => {
      await testCmd(argv as any);
    }
  )
  .command(
    `run <envName>`,
    "Start new network found in global config",
    (yargs) => {
      return yargs.positional("envName", {
        describe: "Network environment to start",
      });
    },
    async (argv) => {
      await runNetwork(argv as any);
    }
  )
  .command("*", "Run the guided walkthrough", async () => {
    await main();
  })
  .options({
    configFile: {
      type: "string",
      alias: "c",
      description: "path to MoonwallConfig file",
      default: "./moonwall.config.json",
    },
    // environment: {
    //   type: "string",
    //   alias: "t",
    //   description: "name of environment tests to run",
    //   demandOption: false,
    // },
  })
  .parse();
