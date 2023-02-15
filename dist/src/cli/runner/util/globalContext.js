"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextCreator = exports.MoonwallContext = void 0;
const types_1 = require("../lib/types");
const providers_1 = require("./providers");
const LocalNode_1 = require("./LocalNode");
const debugSetup = require("debug")("global:context");
const debugNode = require("debug")("global:node");
class MoonwallContext {
    constructor(config) {
        this.environments = [];
        this.providers = [];
        this.nodes = [];
        config.environments.forEach((env) => {
            const blob = { name: env.name, context: {}, providers: [], nodes: [] };
            switch (env.foundation.type) {
                case types_1.FoundationType.ReadOnly:
                    blob.providers = (0, providers_1.prepareProductionProviders)(env.connections);
                    debugSetup(`🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`);
                    break;
                case types_1.FoundationType.DevMode:
                    const item = env.foundation.launchSpec[0];
                    const cmd = item.bin.path;
                    let args = [...item.options];
                    const ports = item.ports;
                    if (ports.p2pPort) {
                        args.push(`--port=${ports.p2pPort}`);
                    }
                    if (ports.wsPort) {
                        args.push(`--ws-port=${ports.wsPort}`);
                    }
                    if (ports.rpcPort) {
                        args.push(`--rpc-port=${ports.rpcPort}`);
                    }
                    debugNode(`The run command is: ${cmd}`);
                    debugNode(`The run args are: ${args}`);
                    blob.nodes.push({
                        name: item.bin.name,
                        cmd,
                        args,
                    });
                    blob.providers = (0, providers_1.prepareProductionProviders)(env.connections);
                    debugSetup(`🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`);
                    break;
                default:
                    debugSetup(`🚧  Foundation "${env.foundation.type}" unsupported, skipping`);
                    return;
            }
            this.environments.push(blob);
        });
    }
    async startNetwork(environmentName) {
        if (this.nodes.length > 0) {
            console.log("Nodes already started! Skipping command");
            return MoonwallContext.getContext();
        }
        const nodes = MoonwallContext.getContext().environments.find((env) => env.name == environmentName).nodes;
        const promises = nodes.map(async ({ cmd, args, name }) => {
            await (0, LocalNode_1.launchDevNode)(cmd, args, name);
        });
        await Promise.all(promises);
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
            console.dir(MoonwallContext.getContext(), { depth: 1 });
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
            debugSetup(`🟢  Moonwall context "${config.label}" created`);
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
    const ctx = MoonwallContext.getContext(config);
    debugSetup(`🟢  Global context fetched for mocha`);
    await ctx.startNetwork(env);
    await ctx.connectEnvironment(env);
    return ctx;
};
exports.contextCreator = contextCreator;
//# sourceMappingURL=globalContext.js.map