import { afterAll, beforeAll } from 'vitest';
import { MoonwallContext, contextCreator } from './globalContext.js';
import { importJsonConfig } from '../../utils/configReader.js';
import Debug from 'debug';
const debugSetup = Debug('global:setup');

beforeAll(async () => {
  const globalConfig = await importJsonConfig();
  if (process.env.TEST_ENV) {
    const ctx = await contextCreator(globalConfig, process.env.TEST_ENV);
    // Only global context is allowed in some vitest specific conditions.
    global.moonInstance = MoonwallContext.getContext();
    await Promise.all(ctx.providers.map(async ({ greet }) => greet()));
  } else {
    throw new Error(`Trouble with env ${process.env.TEST_ENV}`);
  }
});

afterAll(async () => {
  MoonwallContext.destroy();
});
