"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.populateProviderInterface = exports.prepareProductionProviders = void 0;
const moonbeam_types_bundle_1 = require("moonbeam-types-bundle");
const api_1 = require("@polkadot/api");
const web3_1 = __importDefault(require("web3"));
const ethers_1 = require("ethers");
const types_1 = require("../lib/types");
const debug = require("debug")("global:providers");
function prepareProductionProviders(providerConfigs) {
    return providerConfigs.map(({ name, endpoints, type }) => {
        const url = endpoints.includes("ENV_VAR")
            ? process.env.WSS_URL
            : endpoints[0];
        switch (type) {
            case types_1.ProviderType.PolkadotJs:
                debug(`🟢  PolkadotJs provider ${name} details prepared`);
                return {
                    name,
                    type,
                    connect: async () => {
                        const api = await api_1.ApiPromise.create({
                            provider: new api_1.WsProvider(url),
                            initWasm: false,
                            noInitWarn: true
                        });
                        await api.isReady;
                        return api;
                    },
                };
            case types_1.ProviderType.Moonbeam:
                debug(`🟢  Moonbeam provider ${name} details prepared`);
                return {
                    name,
                    type,
                    connect: async () => {
                        const moonApi = await api_1.ApiPromise.create({
                            provider: new api_1.WsProvider(url),
                            rpc: moonbeam_types_bundle_1.rpcDefinitions,
                            typesBundle: moonbeam_types_bundle_1.types,
                            noInitWarn: true,
                        });
                        await moonApi.isReady;
                        return moonApi;
                    },
                };
            case types_1.ProviderType.Web3:
                debug(`🟢  Web3 provider ${name} details prepared`);
                const wsProvider = new web3_1.default.providers.WebsocketProvider(url);
                return {
                    name,
                    type,
                    ws: wsProvider,
                    connect: () => {
                        const ethApi = new web3_1.default(wsProvider);
                        return ethApi;
                    },
                };
            case types_1.ProviderType.Ethers:
                debug(`🟢  Ethers provider ${name} details prepared`);
                return {
                    name,
                    type,
                    connect: async () => {
                        const ethersApi = new ethers_1.ethers.WebSocketProvider(url);
                        return ethersApi;
                    },
                };
            default:
                return {
                    name,
                    type,
                    connect: () => console.log(`🚧  provider ${name} not yet implemented`),
                };
        }
    });
}
exports.prepareProductionProviders = prepareProductionProviders;
async function populateProviderInterface(name, type, connect, disconnect) {
    switch (type) {
        case types_1.ProviderType.PolkadotJs:
            const pjsApi = (await connect());
            return {
                name,
                api: pjsApi,
                greet: () => console.log(`👋  Provider ${name} is connected to chain` +
                    ` ${pjsApi.consts.system.version.specName.toString()} ` +
                    `RT${pjsApi.consts.system.version.specVersion.toNumber()}`),
                disconnect: () => pjsApi.disconnect(),
            };
        case types_1.ProviderType.Moonbeam:
            const mbApi = (await connect());
            return {
                name,
                api: mbApi,
                greet: () => console.log(`👋  Provider ${name} is connected to chain` +
                    ` ${mbApi.consts.system.version.specName.toString()} ` +
                    `RT${mbApi.consts.system.version.specVersion.toNumber()}`),
                disconnect: () => mbApi.disconnect(),
            };
        case types_1.ProviderType.Ethers:
            const ethApi = (await connect());
            return {
                name,
                api: ethApi,
                greet: async () => console.log(`👋 Provider ${name} is connected to chain ` + JSON.stringify(await ethApi.getNetwork())),
                disconnect: () => {
                    ethApi.removeAllListeners();
                    ethApi.destroy();
                },
            };
        case types_1.ProviderType.Web3:
            const web3Api = (await connect());
            return {
                name,
                api: web3Api,
                greet: async () => console.log(`👋 Provider ${name} is connected to chain ` + JSON.stringify(await web3Api.eth.getChainId())),
                disconnect: () => {
                    console.log(web3Api.currentProvider);
                    disconnect();
                    console.log(web3Api.currentProvider);
                },
            };
        default:
            console.log(type);
            console.log(typeof type);
            throw new Error("UNKNOWN TYPE");
    }
}
exports.populateProviderInterface = populateProviderInterface;
//# sourceMappingURL=providers.js.map