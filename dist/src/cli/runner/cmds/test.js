import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import Mocha from "mocha";
import fs from "node:fs/promises";
import path from "node:path";
import { MoonwallContext, contextCreator } from "../internal/globalContext.js";
import { globalConfig } from "../../../../moonwalls.config.js";
export async function testCmd(args) {
    const mocha = new Mocha({
        timeout: globalConfig.defaultTestTimeout,
    });
    mocha.checkLeaks();
    const ctx = await contextCreator(globalConfig, args.environment);
    if (args.environment) {
        await Promise.all(ctx.providers.map(async ({ greet }) => greet()));
        try {
            const dir = globalConfig.environments.find(({ name }) => name === args.environment).testFileDir;
            const files = await fs.readdir(dir);
            files.forEach((base) => mocha.addFile(path.format({ dir, base })));
            console.log(await new Promise((resolve, reject) => {
                mocha.run((failures) => {
                    if (failures) {
                        reject("🚧  At least one test failed, check report for more details.");
                    }
                    resolve("🎉  Test run has completed without errors.");
                });
            }));
            MoonwallContext.destroy();
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
//# sourceMappingURL=test.js.map