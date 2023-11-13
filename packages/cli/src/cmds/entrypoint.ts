import "../internal/logging";
import "@moonbeam-network/api-augment";
import yargs from "yargs";
import fs from "fs";
import { hideBin } from "yargs/helpers";
import { testCmd } from "./runTests";
import { runNetworkCmd } from "./runNetwork";
import { generateConfig } from "../internal/cmdFunctions/initialisation";
import { fetchArtifact } from "../internal/cmdFunctions/fetchArtifact";
import dotenv from "dotenv";
import { Effect, Console, pipe } from "effect";
import { main } from "./main";
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

const setEnvVar = (key: string, value: string) => Effect.sync(() => (process.env[key] = value));

const setupConfigFileEnv = pipe(
  parseConfigFile,
  Effect.flatMap((parsed) => setEnvVar("MOON_CONFIG_PATH", parsed.configFile))
);

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
      const effect = Effect.gen(function* (_) {
        yield* _(Effect.tryPromise(() => generateConfig()));
      });

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
        const effect = Effect.gen(function* (_) {
          yield* _(Effect.tryPromise(() => fetchArtifact(argv as any)));
        });
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
            array: true,
            string: true,
          })
          .positional("GrepTest", {
            type: "string",
            description: "Pattern to grep test ID/Description to run",
          }),
      async ({ envName, GrepTest }) => {
        const effect = pipe(
          Effect.gen(function* (_) {
            if (envName) {
              yield* _(runTestEffect(envName as any, GrepTest));
            } else {
              yield* _(Effect.logError("👉 Run 'pnpm moonwall --help' for more information"));
              yield* _(Effect.fail("❌ No environment specified"));
            }
          }),
          Effect.catchAll((error: any) => Effect.logError(`Error: ${error.message}`))
        );

        await Effect.runPromiseExit(effect);
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
        const effect = Effect.gen(function* (_) {
          yield* _(setEnvVar("MOON_RUN_SCRIPTS", "true"));
          yield* _(Effect.tryPromise(() => runNetworkCmd(argv as any)));
        });

        await Effect.runPromise(effect);
      }
    )
    .help("h")
    .alias("h", "help")
    .parse();
});

const runTestEffect = (envName: string, grepTest?: string) =>
  pipe(
    setEnvVar("MOON_RUN_SCRIPTS", "true"),
    Effect.flatMap(() => Effect.tryPromise(() => testCmd(envName, { testNamePattern: grepTest }))),
    Effect.tap((result) =>
      Effect.succeed(() => {
        process.exitCode = result ? 0 : 1;
      })
    )
  );

const cli = pipe(
  setupConfigFileEnv,
  Effect.flatMap(() => cliStart),
  Effect.catchAll((error: any) => Effect.logError(`Error: ${error.message}`))
);

Effect.runPromise(cli)
  .then((res) => {
    Console.log(res);
    process.exit(0);
  })
  .catch((defect) => {
    Console.error(defect);
    process.exit(1);
  });
