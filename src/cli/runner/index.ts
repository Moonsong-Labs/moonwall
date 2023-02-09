import '@moonbeam-network/api-augment/moonbase';
import "@polkadot/api-augment/polkadot"
import { MoonwallConfig } from './lib/types';
import Mocha, { MochaOptions } from 'mocha';
// import { executeRun, runMochaTests } from './lib/runner-functions';
import { loadConfig } from './util/configReader';
import { ApiPromise } from '@polkadot/api';
import fs from 'fs/promises';
import path from 'path';
import { MoonwallContext } from './util/globalContext';
import { setTimeout } from 'timers/promises';
import { executeRun } from './util/runner-functions';
const debug = require('debug')('global:setup');

export async function runner(args) {
  const config = await loadConfig(args.configFile);
  const mocha = new Mocha({ timeout: config.defaultTestTimeout });

  const contextCreator = () => {
    debug(`🟢  Global context created/fetched`);
    return MoonwallContext.getContext(config);
  };
  const contextDestructor = () => MoonwallContext.destroy();
  mocha.globalSetup(contextCreator);
  mocha.globalTeardown(contextDestructor);
  const ctx = contextCreator();

  if (args.environment) {
    // For files selected by Config.Environments.testFileDir
    try {
      const dir = config.environments.find(({ name }) => name === args.environment)!.testFileDir;
      const files = await fs.readdir(dir);
      files.forEach((base) => mocha.addFile(path.format({ dir, base })));

      await ctx.connect(args.environment);

      ctx.providers.forEach(({ greet }) => greet());

      console.log(
        await new Promise((resolve, reject) => {
          mocha.run((failures) => {
            if (failures) {
              reject('🚧  At least one test failed, check report for more details.');
            }
            resolve('🎉  Test run has completed without errors.');
          });
        })
      );
      process.exitCode = 0;
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  } else {
    // For files selected by positional arg
    // TODO make sure this branch works
    console.log(args.testSpecs);
    ctx.providers.forEach(({ greet }) => greet());
    const options: MochaOptions = {
      timeout: config.defaultTestTimeout,
      require: ['./src/cli/runner/lib/mochaGlobalHooks.ts'],
    };
    const mocha = new Mocha(options);
    args.testSpecs.forEach((testFile) => mocha.addFile(testFile));

    try {
      process.exitCode = 0;
    } catch (e) {
      console.log(e);
      process.exitCode = 1;
    }
  }
}
