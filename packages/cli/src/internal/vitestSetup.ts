import { afterAll, beforeAll } from "vitest";
import { MoonwallContext, contextCreator } from "../lib/globalContext";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
beforeAll(async (vitestContext) => {
  // console.dir(vitestContext, { depth: 2 });
  await contextCreator();
});

afterAll(async () => {
  await MoonwallContext.destroy();
});
