import { importAsyncConfig } from "../../lib/configReader";
import { beforeAll } from "vitest";

beforeAll(async () => {
  globalThis.moonwall = await importAsyncConfig();
});
