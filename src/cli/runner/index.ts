import Mocha, { MochaOptions } from 'mocha';
import { MoonwallConfig } from './lib/types';

export async function runner(tests: any[], config?: MoonwallConfig) {
  const options: MochaOptions = {};
  const mocha = new Mocha({});

  console.log('Arguments provided:');
  console.log(tests);

  console.log('Runner Executed');
}
