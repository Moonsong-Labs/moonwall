import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import fs from "node:fs/promises";
import { globalConfig } from "../../../../moonwall.config.js";
import { startVitest } from "vitest/node";
export async function testCmd(args) {
    if (args.environment) {
        try {
            const dir = globalConfig.environments.find(({ name }) => name === args.environment).testFileDir;
            process.env.TEST_ENV = args.environment;
            const files = await fs.readdir(dir);
            console.log(await new Promise(async (resolve, reject) => {
                const vitest = await startVitest("test", ["test.spec.ts"], {
                    watch: false,
                    globals: true,
                    setupFiles: ["src/cli/runner/internal/setupFixture.ts"],
                });
                await vitest?.close();
                resolve("");
            }));
            process.exit(0);
        }
        catch (e) {
            console.error(e);
            process.exit(1);
        }
    }
    else {
    }
}
//# sourceMappingURL=runTests.js.map