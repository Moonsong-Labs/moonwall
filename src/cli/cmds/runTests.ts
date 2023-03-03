import '@moonbeam-network/api-augment/moonbase';
import '@polkadot/api-augment/polkadot';
import { importJsonConfig } from '../../utils/configReader.js';
import { startVitest } from 'vitest/node';
import { UserConfig } from 'vitest';
import { MoonwallContext, contextCreator } from '../internal/globalContext.js';
import { Environment } from '../../types/config.js';
import url from 'url';
import path from 'path';
import { option } from 'yargs';

export async function testCmd(args) {
  const globalConfig = await importJsonConfig();
  const env = globalConfig.environments.find(({ name }) => name === args.envName)!;
  process.env.TEST_ENV = args.envName;
  try {
    const vitest = await executeTests(env);
    await vitest!.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    MoonwallContext.destroy();
    process.exit(1);
  }
}

export async function executeTests(env: Environment) {
  const currDir = url.fileURLToPath(new URL('.', import.meta.url));
  const setupPath = path.join(currDir, '..', 'internal', 'setupFixture');
  const options: UserConfig = {
    watch: false,
    globals: true,
    reporters: env.html ? ['verbose', 'html'] : ['verbose'],
    testTimeout: 10000,

    hookTimeout: 500000,
    setupFiles: [setupPath],
    include: env.include ? env.include : ['**/{test,spec,test_,test-}*{ts,mts,cts}']
  };

  if (env.threads && env.threads > 1) {
    options.threads = true;
    options.minThreads = env.threads;
    // options.isolate = false
  } else {
    options.singleThread = true;
    options.threads = false;
    options.isolate = false;
  }
  try {
    const folders = env.testFileDir.map((folder) => path.join('/', folder, '/'));
    return await startVitest('test', folders, options);
  } catch (e) {
    throw new Error(e);
  }
}
