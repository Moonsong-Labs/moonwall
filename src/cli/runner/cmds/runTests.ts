import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
// import Mocha, { MochaOptions } from "mocha";
import { loadConfig } from "../util/configReader.js";
import fs from "node:fs/promises";
import path from "node:path";
import { MoonwallContext, contextCreator } from "../internal/globalContext.js";
import { globalConfig } from "../../../../moonwall.config.js";
import { getAbsolutePath } from "esm-path";
import { createVitest, startVitest } from "vitest/node";

export async function testCmd(args) {
  // const ctx = await contextCreator(globalConfig, args.environment);
  // For files selected by Config.Environments.testFileDir
  if (args.environment) {
    try {
      const dir = globalConfig.environments.find(
        ({ name }) => name === args.environment
      ).testFileDir;

      process.env.TEST_ENV = args.environment;

      // TODO: sort out reporter config
      const files = await fs.readdir(dir);
      console.log(
        await new Promise(async (resolve, reject) => {
          const vitest = await startVitest("test", files, {
            watch: false,
            globals: true,
            reporters:["verbose", "html"],
            setupFiles: ["src/cli/runner/internal/setupFixture.ts"],
          });
          await vitest?.close();
          resolve("");
          // mocha.run((failures) => {
          //   if (failures) {
          //     reject(
          //       "🚧  At least one test failed, check report for more details."
          //     );
          //   }
          //   resolve("🎉  Test run has completed without errors.");
          // });
        })
      );
      // MoonwallContext.destroy();
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
