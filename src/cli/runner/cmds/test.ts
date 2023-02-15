import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import Mocha, { MochaOptions } from "mocha";
import { loadConfig } from "../util/configReader";
import fs from "fs/promises";
import path from "path";
import { MoonwallContext, contextCreator } from "../internal/globalContext";
import { globalConfig } from "../../../../moonwalls.config";
const debug = require("debug")("global:setup");

export async function testCmd(args) {
  const mocha = new Mocha({
    timeout: globalConfig.defaultTestTimeout,
    require: [
      "index.ts",
      path.join(__dirname, "index"),
      "./src/cli/runner/util/globalContext.ts",
      "./util/globalContext.ts",
    ],
  });

  mocha.checkLeaks();
  const ctx = await contextCreator(globalConfig, args.environment);

  // For files selected by Config.Environments.testFileDir
  if (args.environment) {
    await Promise.all(ctx.providers.map(async ({ greet }) => greet()));
    try {
      const dir = globalConfig.environments.find(
        ({ name }) => name === args.environment
      ).testFileDir;
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
      MoonwallContext.destroy();
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  } else {
    // For files selected by positional arg
    // TODO implement this code branch
  }
}
