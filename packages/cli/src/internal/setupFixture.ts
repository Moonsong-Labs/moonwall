import { afterAll, beforeAll, beforeEach } from "vitest";
import { MoonwallContext, contextCreator } from "../lib/globalContext.js";
import { importJsonConfig } from "../lib/configReader.js";
import Debug from "debug";
import { setTimeout } from "node:timers/promises";
const debugSetup = Debug("global:setup");

beforeAll(async () => {
  //   console.log("before all")
  // console.log(process.env.MOON_TEST_ENV)
  //     const globalConfig = await importJsonConfig();
  //     const ctx = await contextCreator(globalConfig, process.env.MOON_TEST_ENV);
  //     // Only global context is allowed in some vitest specific conditions.
  //     global.moonInstance = MoonwallContext.getContext();
  //     await Promise.all(ctx.providers.map(async ({ greet }) => greet()));
});

afterAll(async () => {
  // if (process.env.MOONRECYCLE !== "true") {
  // await MoonwallContext.destroy();
  // delete global.moonInstance;
  // }
});
