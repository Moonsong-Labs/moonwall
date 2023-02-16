import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import fs from "node:fs/promises";
import { globalConfig } from "../../../../moonwall.config.js";
import { startVitest } from "vitest/node";
export async function testCmd(args) {
    if (args.environment) {
        const env = globalConfig.environments.find(({ name }) => name === args.environment);
        process.env.TEST_ENV = args.environment;
        const files = await fs.readdir(env.testFileDir);
        const options = {
            watch: false,
            globals: true,
            reporters: ["verbose"],
            setupFiles: ["src/cli/runner/internal/setupFixture.ts"],
            include: env.include
                ? env.include
                : ["**/{test,spec,test_,test-}*{ts,mts,cts}"],
        };
        const vitest = await startVitest("test", files, options);
        await vitest.close();
    }
    else {
    }
}
//# sourceMappingURL=runTests.js.map