import { MoonwallConfig } from './lib/types';
import Mocha, { MochaOptions } from 'mocha';
import { executeRun, runMochaTests } from './lib/runner-functions';
import { loadConfig } from './lib/util/configReader';
import { ApiPromise } from '@polkadot/api';
import fs from 'fs/promises';
import path from 'path';
import { MoonwallContext } from './lib/globalContext';
import { setTimeout } from 'timers/promises';

export async function runner(args) {
  const config = await loadConfig(args.configFile);
  const ctx = MoonwallContext.getContext(config);

  await setTimeout(6000)
  const options: MochaOptions = {
    timeout: config.defaultTestTimeout,
    require: ['./src/cli/runner/lib/mochaGlobalHooks.ts'],
  };
  const mocha = new Mocha(options).enableGlobalSetup(true).enableGlobalTeardown(true);


  if (args.environment) {
    try {
      const dir = config.environments.find(({ name }) => name === args.environment)!.testFileDir;
      const files = await fs.readdir(dir);
      files.forEach((base) => mocha.addFile(path.format({ dir, base })));

      await ctx.connect(args.environment);

      ctx.providers.forEach(({ greet }) => greet());
      const result = await runMochaTests(mocha);
      console.log(result);
      ctx.disconnect();
      process.exitCode = 0;
      // executeRun(ctx, mocha)
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  } else {
    console.log(args.testSpecs);
    args.testSpecs.forEach((testFile) => mocha.addFile(testFile));

    try {
      const result = await runMochaTests(mocha);
      console.log(result);
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
