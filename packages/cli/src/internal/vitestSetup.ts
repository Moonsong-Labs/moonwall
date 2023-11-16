import { importJsonConfig } from "../lib/configReader";
import { beforeAll } from "vitest";

beforeAll(() => {
  globalThis.config = importJsonConfig();
});
