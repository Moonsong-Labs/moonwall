import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import Mocha, { MochaOptions } from "mocha";
import { loadConfig } from "./util/configReader";
import fs from "fs/promises";
import path from "path";
import { MoonwallContext, contextCreator } from "./util/globalContext";
import { MoonwallConfig } from "./lib/types";
const debug = require("debug")("global:setup");



export async function runner(args) {
  const config = await loadConfig(args.configFile);
  const mocha = new Mocha({ timeout: config.defaultTestTimeout, require:["index.ts", "./src/cli/runner/index.ts"] });

  mocha.checkLeaks();
  await contextCreator(config, args.environment)

  if (args.environment) {
    // For files selected by Config.Environments.testFileDir
    try {
      const dir = config.environments.find(
        ({ name }) => name === args.environment
      )!.testFileDir;
      const files = await fs.readdir(dir);
      files.forEach((base) => mocha.addFile(path.format({ dir, base })));
      console.log(
        await new Promise((resolve, reject) => {
          mocha.run((failures) => {
            if (failures) {
              reject(
                "🚧  At least one test failed, check report for more details."
              );
            }
            resolve("🎉  Test run has completed without errors.");
          });
        })
      );
      MoonwallContext.destroy()
      process.exitCode = 0;
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  } else {
    // For files selected by positional arg
    // TODO implement this code branch
  }
}
