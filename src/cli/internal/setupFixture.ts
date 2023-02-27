import { afterAll, beforeAll } from "vitest";
import { MoonwallContext, contextCreator } from "./globalContext.js";
import { importConfig } from "../../utils/configReader.js";
import Debug from "debug";
const debugSetup = Debug("global:setup");

beforeAll(async () => {
  const globalConfig = await importConfig("../../moonwall.config.js");
  if (process.env.TEST_ENV) {
    const ctx = await contextCreator(globalConfig, process.env.TEST_ENV);
    // await Promise.all(ctx.providers.map(async ({ greet }) => greet()));
  } else {
    throw new Error(`Trouble with env ${process.env.TEST_ENV}`);
  }
});

afterAll(async () => {
  MoonwallContext.destroy();
});
