import { afterAll, beforeAll } from "vitest";
import { MoonwallContext, contextCreator, runNetworkOnly } from "../lib/globalContext";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
beforeAll(async (vitestContext) => {
  // console.dir(vitestContext, { depth: 2 });
  await contextCreator();
  await runNetworkOnly();
});

afterAll(async () => {
  await MoonwallContext.destroy();
});
