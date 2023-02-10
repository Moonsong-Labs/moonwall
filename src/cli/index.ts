#!/usr/bin/env ts-node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runner } from './runner';

yargs(hideBin(process.argv))
  .usage('Usage: $0')
  .version('2.0.0')
  .command(
    `test [testSpecs..]`,
    'Run tests found in test specs',
    (yargs) => {
      return yargs.positional('testSpecs', {
        alias: 'testSpecs',
        array: true,
        describe: 'Path to test spec file(s)',
        default: '*.ts',
      });
    },
    async (argv) => {
      await runner(argv as any);
    }
  )
  .options({
    configFile: {
      type: 'string',
      alias: 'c',
      description: 'path to MoonwallConfig file',
      default: "./moonwall.config.json"
    },
    environment: {
      type: 'string',
      alias: 't',
      description: 'name of environment tests to run',
      demandOption: false
    },
  })
  .parse();
