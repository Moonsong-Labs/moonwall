#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { MoonwallConfig, MoonwallTestFile } from './runner/lib/types';
import { runner } from './runner';

yargs(hideBin(process.argv))
  .usage('Usage: $0')
  .version('2.0.0')
  .command(
    `test`,
    'run tests found in test files',
    (yargs) => {
      return yargs.option('testSpecs', {
        alias: "f",
        describe: "Path to test spec file(s)",
        demandOption: true,
      });
    },
    (argv) => {
      runner(argv.testSpecs as any);
    }
  )
  .options({
    configFile: {
      type: 'string',
      alias: 'c',
      description: 'path to MoonwallConfig file',
      demandOption: false,
    },
  })
  .parse();
