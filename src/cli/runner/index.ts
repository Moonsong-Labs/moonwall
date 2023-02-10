import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import {
  typesBundlePre900,
  rpcDefinitions,
  types,
} from "moonbeam-types-bundle";
import { MoonwallConfig } from "./lib/types";
import Mocha, { MochaOptions } from "mocha";
// import { executeRun, runMochaTests } from './lib/runner-functions';
import { loadConfig } from "./util/configReader";
import { ApiPromise, WsProvider } from "@polkadot/api";
import fs from "fs/promises";
import path from "path";
import { MoonwallContext } from "./util/globalContext";
import { setTimeout } from "timers/promises";
import { executeRun } from "./util/runner-functions";
import { WebSocketProvider } from "ethers";
import { monitorEventLoopDelay } from "perf_hooks";
const debug = require("debug")("global:setup");

export async function runner(args) {
  const config = await loadConfig(args.configFile);
  const mocha = new Mocha({ timeout: config.defaultTestTimeout });
  mocha.enableGlobalSetup(true);
  mocha.enableGlobalTeardown(true);
  mocha.checkLeaks();

  const contextFetcher = async () => {
    const ctx = MoonwallContext.getContext(config);
    debug(`🟢  Global context fetched for mocha`);
    await ctx.connectEnvironment(args.environment);
    ctx.providers.forEach(async ({ greet }) => await greet());
  };
  const contextDestructor = () => MoonwallContext.destroy();


  mocha.globalSetup(contextFetcher);
  mocha.globalTeardown(contextDestructor);

  await MoonwallContext.getContext(config).connectEnvironment(args.environment);

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
