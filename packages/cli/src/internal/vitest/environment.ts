import { importJsonConfig } from "../../lib/configReader";
import { beforeAll } from "vitest";

beforeAll(async () => {
  globalThis.moonwall = importJsonConfig();
});
