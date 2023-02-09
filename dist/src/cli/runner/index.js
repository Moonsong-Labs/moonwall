"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runner = void 0;
require("@moonbeam-network/api-augment");
require("@polkadot/api-augment/polkadot");
const mocha_1 = __importDefault(require("mocha"));
const configReader_1 = require("./util/configReader");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const globalContext_1 = require("./util/globalContext");
const debug = require('debug')('global:setup');
async function runner(args) {
    const config = await (0, configReader_1.loadConfig)(args.configFile);
    const mocha = new mocha_1.default({ timeout: config.defaultTestTimeout });
    const contextCreator = () => {
        debug(`🟢  Global context created/fetched`);
        return globalContext_1.MoonwallContext.getContext(config);
    };
    const contextDestructor = () => globalContext_1.MoonwallContext.destroy();
    mocha.globalSetup(contextCreator);
    mocha.globalTeardown(contextDestructor);
    const ctx = contextCreator();
    if (args.environment) {
        try {
            const dir = config.environments.find(({ name }) => name === args.environment).testFileDir;
            const files = await promises_1.default.readdir(dir);
            files.forEach((base) => mocha.addFile(path_1.default.format({ dir, base })));
            await ctx.connect(args.environment);
            ctx.providers.forEach(({ greet }) => greet());
            console.log(await new Promise((resolve, reject) => {
                mocha.run((failures) => {
                    if (failures) {
                        reject('🚧  At least one test failed, check report for more details.');
                    }
                    resolve('🎉  Test run has completed without errors.');
                });
            }));
            process.exitCode = 0;
        }
        catch (e) {
            console.error(e);
            process.exit(1);
        }
    }
    else {
        console.log(args.testSpecs);
        ctx.providers.forEach(({ greet }) => greet());
        const options = {
            timeout: config.defaultTestTimeout,
            require: ['./src/cli/runner/lib/mochaGlobalHooks.ts'],
        };
        const mocha = new mocha_1.default(options);
        args.testSpecs.forEach((testFile) => mocha.addFile(testFile));
        try {
            process.exitCode = 0;
        }
        catch (e) {
            console.log(e);
            process.exitCode = 1;
        }
    }
}
exports.runner = runner;
//# sourceMappingURL=index.js.map