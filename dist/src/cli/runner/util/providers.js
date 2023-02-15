import { rpcDefinitions, types, } from "moonbeam-types-bundle";
import { ApiPromise, WsProvider } from "@polkadot/api";
import Web3 from "web3";
import { ethers } from "ethers";
import { ProviderType, } from "../lib/types.js";
import Debug from "debug";
const debug = Debug("global:providers");
export function prepareProviders(providerConfigs) {
    return providerConfigs.map(({ name, endpoints, type }) => {
        const url = endpoints.includes("ENV_VAR")
            ? process.env.WSS_URL
            : endpoints[0];
        switch (type) {
            case ProviderType.PolkadotJs:
                debug(`🟢  PolkadotJs provider ${name} details prepared`);
                return {
                    name,
                    type,
                    connect: async () => {
                        const api = await ApiPromise.create({
                            provider: new WsProvider(url),
                            initWasm: false,
                            noInitWarn: true
                        });
                        await api.isReady;
                        return api;
                    },
                };
            case ProviderType.Moonbeam:
                debug(`🟢  Moonbeam provider ${name} details prepared`);
                return {
                    name,
                    type,
                    connect: async () => {
                        const moonApi = await ApiPromise.create({
                            provider: new WsProvider(url),
                            rpc: rpcDefinitions,
                            typesBundle: types,
                            noInitWarn: true,
                        });
                        await moonApi.isReady;
                        return moonApi;
                    },
                };
            case ProviderType.Web3:
                debug(`🟢  Web3 provider ${name} details prepared`);
                return {
                    name,
                    type,
                    connect: () => {
                        const wsProvider = new Web3.providers.WebsocketProvider(url);
                        const ethApi = new Web3(wsProvider);
                        return ethApi;
                    },
                };
            case ProviderType.Ethers:
                debug(`🟢  Ethers provider ${name} details prepared`);
                return {
                    name,
                    type,
                    connect: async () => {
                        const ethersApi = new ethers.WebSocketProvider(url);
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
export async function populateProviderInterface(name, type, connect, ws) {
    switch (type) {
        case ProviderType.PolkadotJs:
            const pjsApi = (await connect());
            return {
                name,
                api: pjsApi,
                type,
                greet: () => debug(`👋  Provider ${name} is connected to chain` +
                    ` ${pjsApi.consts.system.version.specName.toString()} ` +
                    `RT${pjsApi.consts.system.version.specVersion.toNumber()}`),
                disconnect: () => pjsApi.disconnect(),
            };
        case ProviderType.Moonbeam:
            const mbApi = (await connect());
            return {
                name,
                api: mbApi,
                type,
                greet: () => debug(`👋  Provider ${name} is connected to chain` +
                    ` ${mbApi.consts.system.version.specName.toString()} ` +
                    `RT${mbApi.consts.system.version.specVersion.toNumber()}`),
                disconnect: () => mbApi.disconnect(),
            };
        case ProviderType.Ethers:
            const ethApi = (await connect());
            return {
                name,
                api: ethApi,
                type,
                greet: async () => debug(`👋  Provider ${name} is connected to chain ` + (await ethApi.getNetwork()).chainId),
                disconnect: () => {
                    ethApi.removeAllListeners();
                    ethApi.provider.destroy();
                    ethApi.destroy();
                },
            };
        case ProviderType.Web3:
            const web3Api = (await connect());
            return {
                name,
                api: web3Api,
                type,
                greet: async () => console.log(`👋 Provider ${name} is connected to chain ` + await web3Api.eth.getChainId()),
                disconnect: () => {
                },
            };
        default:
            console.log(type);
            console.log(typeof type);
            throw new Error("UNKNOWN TYPE");
    }
}
//# sourceMappingURL=providers.js.map