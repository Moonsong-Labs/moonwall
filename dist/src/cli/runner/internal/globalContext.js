import { FoundationType, ProviderType, } from "../lib/types";
import { populateProviderInterface, prepareProviders } from "../util/providers.js";
import { launchDevNode } from "../util/LocalNode.js";
import globalConfig from "../../../../moonwall.config.js";
import { parseRunCmd } from "./devFoundation.js";
import Debug from "debug";
const debugSetup = Debug("global:context");
const debugNode = Debug("global:node");
export class MoonwallContext {
    static instance;
    environments;
    providers;
    nodes;
    foundation;
    _genesis;
    constructor(config) {
        this.environments = [];
        this.providers = [];
        this.nodes = [];
        config.environments.forEach((env) => {
            const blob = { name: env.name, context: {}, providers: [], nodes: [] };
            switch (env.foundation.type) {
                case FoundationType.ReadOnly:
                    if (!env.connections) {
                        throw new Error(`${env.name} env config is missing connections specification, required by foundation READ_ONLY`);
                    }
                    else {
                        blob.providers = prepareProviders(env.connections);
                    }
                    debugSetup(`🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`);
                    break;
                case FoundationType.DevMode:
                    const { cmd, args } = parseRunCmd(env.foundation.launchSpec[0]);
                    debugNode(`The run command is: ${cmd}`);
                    debugNode(`The run args are: ${args}`);
                    blob.nodes.push({
                        name: env.foundation.launchSpec[0].bin.name,
                        cmd,
                        args,
                    });
                    blob.providers = env.connections
                        ? prepareProviders(env.connections)
                        : prepareProviders([
                            {
                                name: "w3",
                                type: ProviderType.Web3,
                                endpoints: ["ws://localhost:9944"],
                            },
                            {
                                name: "eth",
                                type: ProviderType.Ethers,
                                endpoints: ["ws://localhost:9944"],
                            },
                            {
                                name: "polka",
                                type: ProviderType.PolkadotJs,
                                endpoints: ["ws://localhost:9944"],
                            },
                        ]);
                    debugSetup(`🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`);
                    break;
                default:
                    debugSetup(`🚧  Foundation "${env.foundation.type}" unsupported, skipping`);
                    return;
            }
            this.environments.push(blob);
        });
    }
    get genesis() {
        return this._genesis;
    }
    set genesis(hash) {
        if (hash.length !== 66) {
            throw new Error("Cannot set genesis to invalid hash");
        }
        this._genesis = hash;
    }
    async startNetwork(environmentName) {
        if (this.nodes.length > 0) {
            console.log("Nodes already started! Skipping command");
            return MoonwallContext.getContext();
        }
        const nodes = MoonwallContext.getContext().environments.find((env) => env.name == environmentName).nodes;
        const promises = nodes.map(async ({ cmd, args, name }) => {
            await launchDevNode(cmd, args, name);
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
                ? await populateProviderInterface(name, type, connect, ws)
                : await populateProviderInterface(name, type, connect);
            this.providers.push(providerDetails);
            resolve("");
        }));
        await Promise.all(promises);
        this.foundation = globalConfig.environments.find(({ name }) => name == environmentName).foundation.type;
        if (this.foundation == FoundationType.DevMode) {
            this.genesis = (await this.providers.find(({ type }) => type == ProviderType.PolkadotJs || type == ProviderType.Moonbeam).api.rpc.chain.getBlockHash(0)).toString();
        }
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
export const contextCreator = async (config, env) => {
    const ctx = MoonwallContext.getContext(config);
    debugSetup(`🟢  Global context fetched for mocha`);
    await ctx.startNetwork(env);
    await ctx.connectEnvironment(env);
    return ctx;
};
export const runNetworkOnly = async (config, env) => {
    const ctx = MoonwallContext.getContext(config);
    debugSetup(`🟢  Global context fetched for mocha`);
    await ctx.startNetwork(env);
};
//# sourceMappingURL=globalContext.js.map