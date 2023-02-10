"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextCreator = exports.MoonwallContext = void 0;
const providers_1 = require("./providers");
const debug = require("debug")("global:context");
class MoonwallContext {
    constructor(config) {
        this.environments = [];
        this.providers = [];
        config.environments.forEach((env) => {
            const blob = { name: env.name, context: {}, providers: [] };
            switch (env.foundation.type) {
                case "production":
                    blob.providers = (0, providers_1.prepareProductionProviders)(env.connections);
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
    async connectEnvironment(environmentName) {
        if (this.providers.length > 0) {
            console.log("Providers already connected! Skipping command");
            return MoonwallContext.getContext();
        }
        const promises = this.environments
            .find(({ name }) => name === environmentName)
            .providers.map(async ({ name, type, connect, ws }) => new Promise(async (resolve) => {
            const providerDetails = ws
                ? await (0, providers_1.populateProviderInterface)(name, type, connect, ws)
                : await (0, providers_1.populateProviderInterface)(name, type, connect);
            this.providers.push(providerDetails);
            resolve("");
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
            console.log(MoonwallContext.getContext());
        }
        else {
            console.log("Global context not created!");
        }
    }
    static getContext(config) {
        if (!MoonwallContext.instance) {
            if (!config) {
                console.error("❌ Config must be provided on Global Context instantiation");
                process.exit(1);
            }
            MoonwallContext.instance = new MoonwallContext(config);
            debug(`🟢  Moonwall context "${config.label}" created`);
        }
        return MoonwallContext.instance;
    }
    static destroy() {
        try {
            MoonwallContext.getContext().disconnect();
        }
        catch {
            console.log("🛑  All connections disconnected");
        }
        delete MoonwallContext.instance;
    }
}
exports.MoonwallContext = MoonwallContext;
const contextCreator = async (config, env) => {
    console.log(env);
    const ctx = MoonwallContext.getContext(config);
    debug(`🟢  Global context fetched for mocha`);
    await ctx.connectEnvironment(env);
    ctx.providers.forEach(async ({ greet }) => await greet());
};
exports.contextCreator = contextCreator;
//# sourceMappingURL=globalContext.js.map