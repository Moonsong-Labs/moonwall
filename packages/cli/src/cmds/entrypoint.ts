import "@moonbeam-network/api-augment";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { setTimeout } from "timers/promises";
import { testCmd } from "./runTests.js";
import { runNetwork } from "./runNetwork.js";
import { generateConfig } from "./generateConfig.js";
import { main } from "./main.js";
import { downloader } from "./downloader.js";

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
          describe: "Name of artifact to download\n[ moonbeam | polkadot | *-runtime ]",
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
    `test <envName> [GrepTest]`,
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
        });
    },
    async (args) => {
      const envList = (args.envName as any).split(" ");
      const testRuns = [];
      for (const env of envList) {
        testRuns.push(await testCmd(env, { testNamePattern: args.GrepTest }));
      }
      await Promise.all(testRuns);
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
