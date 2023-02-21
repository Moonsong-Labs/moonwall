import { afterAll, beforeAll } from "vitest";
import { MoonwallContext, contextCreator } from "./globalContext.js";
import { importConfig } from "../../../utils/configReader.js";

beforeAll(async () => {
  const globalConfig = await importConfig("../../../../moonwall.config.js")
  const ctx = await contextCreator(globalConfig, process.env.TEST_ENV);
  await Promise.all(ctx.providers.map(async ({ greet }) => greet()));
});

afterAll(async () => {
  MoonwallContext.destroy();
});
