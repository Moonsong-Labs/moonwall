"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoonwallContext = void 0;
const promises_1 = require("timers/promises");
const providers_1 = require("./providers");
const debug = require('debug')('global:context');
class MoonwallContext {
    constructor(config) {
        this.environments = [];
        this.providers = [];
        config.environments.forEach((env) => {
            const blob = { name: env.name, context: {}, providers: [] };
            switch (env.foundation.type) {
                case 'production':
                    blob.providers.push(...(0, providers_1.prepareProductionProviders)(env.connections));
                    debug(`🟢  Foundation "${env.foundation.type}" setup`);
                    break;
                default:
                    debug(`🚧  Foundation "${env.foundation.type}" unsupported, skipping setup`);
                    return;
            }
            this.environments.push(blob);
        });
    }
    env(query) {
        return this.environments.find(({ name }) => name == query);
    }
    async connect(environmentName) {
        const promises = this.environments
            .find(({ name }) => name === environmentName)
            .providers.map(async ({ name, connect }) => new Promise(async (resolve) => {
            const providerDetails = await (0, providers_1.populateProviderInterface)(name, connect);
            this.providers.push(providerDetails);
            resolve('');
        }));
        await Promise.all(promises);
    }
    disconnect(providerName) {
        if (providerName) {
            this.providers.find(({ name }) => name === providerName).disconnect();
        }
        else {
            this.providers.forEach((prov) => prov.disconnect());
        }
    }
    static printStats() {
        if (MoonwallContext) {
            console.log(MoonwallContext.instance);
        }
        else {
            console.log('Global context not created!');
        }
    }
    static getContext(config) {
        if (!MoonwallContext.instance) {
            if (!config) {
                console.error('❌ Config must be provided on Global Context instantiation');
                process.exit(1);
            }
            MoonwallContext.instance = new MoonwallContext(config);
        }
        return MoonwallContext.instance;
    }
    static async destroy() {
        MoonwallContext.instance.disconnect();
        delete MoonwallContext.instance;
        await (0, promises_1.setTimeout)(2000);
    }
}
exports.MoonwallContext = MoonwallContext;
//# sourceMappingURL=globalContext.js.map