import { afterAll, beforeAll } from "vitest";
import { MoonwallContext, contextCreator } from "../lib/globalContext.js";
import { importJsonConfig } from "../lib/configReader.js";
import Debug from "debug";
import { setTimeout } from "node:timers/promises";
const debugSetup = Debug("global:setup");

beforeAll(async () => {
  if (process.env.TEST_ENV) {
    const globalConfig = await importJsonConfig();
    const ctx = await contextCreator(globalConfig, process.env.TEST_ENV);

    // Only global context is allowed in some vitest specific conditions.
    global.moonInstance = MoonwallContext.getContext();
    await Promise.all(ctx.providers.map(async ({ greet }) => greet()));
  } else {
    throw new Error(`Trouble with env ${process.env.TEST_ENV}`);
  }
});

afterAll(async () => {
  if (process.env.RECYCLE !== "true") {
    await MoonwallContext.destroy();
    delete global.moonInstance;
  }
});
