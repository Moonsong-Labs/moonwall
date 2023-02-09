import { MoonwallConfig } from './lib/types';
import Mocha, { MochaOptions } from 'mocha';
// import { executeRun, runMochaTests } from './lib/runner-functions';
import { loadConfig } from './lib/util/configReader';
import { ApiPromise } from '@polkadot/api';
import fs from 'fs/promises';
import path from 'path';
import { MoonwallContext, getContext } from './lib/globalContext';
import { setTimeout } from 'timers/promises';

export async function runner(args) {

  // async function executeRun(ctx) {
  //   try {
  //     const result = await runMochaTests();
  //     console.log(result);
  //     ctx.disconnect();
  //     process.exitCode = 0;
  //   } catch (e) {
  //     console.log(e);
  //     process.exitCode = 1;
  //   }
  // }

  // const runMochaTests = () => {
  //   return new Promise((resolve, reject) => {
  //     console.log("before actual run")
  //     mocha.run((failures) => {
  //       if (failures) {
  //         reject('🚧  At least one test failed, check report for more details.');
  //       }
  //       resolve('🎉  Test run has completed without errors.');
  //     });
  //   });
  // };

  const config = await loadConfig(args.configFile);
  const ctx = getContext(config);

  if (args.environment) {
    try {
      const options: MochaOptions = {
        timeout: config.defaultTestTimeout,
        require: ["./timbo"]
      };
      const mocha = new Mocha(options);
      const dir = config.environments.find(({ name }) => name === args.environment)!.testFileDir;
      const files = await fs.readdir(dir);
      files.forEach((base) => mocha.addFile(path.format({ dir, base })));

      await ctx.connect(args.environment);

      ctx.providers.forEach(({ greet }) => greet());
      console.log("before run")
      // const result = await runMochaTests();
      console.log(await new Promise((resolve,reject)=>{
        mocha.run((failures) => {
          if (failures) {
            reject('🚧  At least one test failed, check report for more details.');
          }
          resolve('🎉  Test run has completed without errors.');
        });
      }))

      ctx.disconnect();
      process.exitCode = 0;
      // executeRun(ctx, mocha)
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  } else {
    console.log(args.testSpecs);
    ctx.providers.forEach(({ greet }) => greet());

    const options: MochaOptions = {
      timeout: config.defaultTestTimeout,
      require: ['./src/cli/runner/lib/mochaGlobalHooks.ts'],
    };
    const mocha = new Mocha(options);
    args.testSpecs.forEach((testFile) => mocha.addFile(testFile));

    try {
      // const result = await runMochaTests();
      // console.log(result);
      ctx.disconnect();
      process.exitCode = 0;
    } catch (e) {
      console.log(e);
      process.exitCode = 1;
    }
  }

  // RUN SPEC TO FIND TEST FILES

  // READ FILES TO ADD TESTS
}



