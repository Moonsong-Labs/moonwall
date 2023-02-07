import Mocha, { MochaOptions } from 'mocha';
import { MoonwallConfig } from './lib/types';
import path from 'path';
import fs from 'fs/promises';
import { runMochaTests } from './lib/runner-functions';

export async function runner(args) {
  // READ CONFIG TO CONSTRUCT CONCEPT OF NETWORKS

  // parseConfig(config)
  //refactor this vv
  if (
    !(await fs
      .access(args.configFile)
      .then(() => true)
      .catch(() => false))
  ) {
    throw new Error(`Moonwall Config file ${args.configFile} cannot be found`);
  }

  const file = await fs.readFile(args.configFile, { encoding: 'utf-8' });
  const config = JSON.parse(file) as MoonwallConfig;

  console.log(config);

  ///////////////////

  const options: MochaOptions = { timeout: config.defaultTestTimeout };
  const mocha = new Mocha(options);

  args.testSpecs.forEach((testFile) => mocha.addFile(testFile));

  // RUN SPEC TO FIND TEST FILES

  // READ FILES TO ADD TESTS

  try {
    const result = await runMochaTests(mocha);
    console.log(result);
    process.exitCode = 0;
  } catch (e) {
    console.log(e);
    process.exitCode = 1;
  }
}
