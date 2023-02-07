import Mocha, { MochaOptions } from 'mocha';
import { MoonwallConfig } from './lib/types';
import path from 'path';
import fs from 'fs/promises';
import { runMochaTests } from './lib/runner-functions';

export async function runner(tests, config?: MoonwallConfig) {
  const options: MochaOptions = {};
  const mocha = new Mocha(options);

  // READ CONFIG TO CONSTRUCT CONCEPT OF NETWORKS
  // parseConfig()

  tests.forEach((testFile) => mocha.addFile(testFile));

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
