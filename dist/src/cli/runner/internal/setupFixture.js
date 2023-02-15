import { beforeAll } from "vitest";
import { globalConfig } from "../../../../moonwall.config.js";
import { contextCreator } from "./globalContext.js";
beforeAll(async () => {
    const ctx = await contextCreator(globalConfig, process.env.TEST_ENV);
    await Promise.all(ctx.providers.map(async ({ greet }) => greet()));
});
//# sourceMappingURL=setupFixture.js.map