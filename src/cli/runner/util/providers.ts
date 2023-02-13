import {
  rpcDefinitions,
  types,
} from "moonbeam-types-bundle";
import { ApiPromise, WsProvider } from "@polkadot/api";
import Web3 from "web3";
import { ethers } from "ethers";
import {
  ConnectedProvider,
  MoonwallConfig,
  MoonwallEnvironment,
  MoonwallProvider,
  ProviderConfig,
  ProviderType,
} from "../lib/types";
import { ApiOptions } from "@polkadot/api/types";
import { WebSocketProvider } from "ethers";
import { Web3BaseProvider}   from "web3-types"
const debug = require("debug")("global:providers");

export function prepareProductionProviders(
  providerConfigs: ProviderConfig[]
): MoonwallProvider[] {

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
        const wsProvider: Web3BaseProvider =new Web3.providers.WebsocketProvider(url)
        return {
          name,
          type,
          ws: wsProvider,
          connect: () => {
            const ethApi = new Web3(wsProvider)
            return ethApi;
          },
        };

        case ProviderType.Ethers:
        debug(`🟢  Ethers provider ${name} details prepared`);
        return {
          name,
          type,
          connect: async () => {
            const ethersApi = new ethers.WebSocketProvider(url)
            return ethersApi;
          },
        };

      default:
        return {
          name,
          type,
          connect: () =>
            console.log(`🚧  provider ${name} not yet implemented`),
        };
    }
  });
}

export async function populateProviderInterface(
  name: string,
  type: ProviderType,
  connect: () => Promise<ApiPromise> | Promise<WebSocketProvider> |Web3 | void,
  ws?: () => void
) {
  switch (type) {
    case ProviderType.PolkadotJs:
      const pjsApi = (await connect()) as ApiPromise;
      return {
        name,
        api: pjsApi,
        greet: () =>
          debug(
            `👋  Provider ${name} is connected to chain` +
              ` ${pjsApi.consts.system.version.specName.toString()} ` +
              `RT${pjsApi.consts.system.version.specVersion.toNumber()}`
          ),
        disconnect: () => pjsApi.disconnect(),
      };

    case  ProviderType.Moonbeam:
      const mbApi = (await connect()) as ApiPromise;
      return {
        name,
        api: mbApi,
        greet: () =>
          debug(
            `👋  Provider ${name} is connected to chain` +
              ` ${mbApi.consts.system.version.specName.toString()} ` +
              `RT${mbApi.consts.system.version.specVersion.toNumber()}`
          ),
        disconnect: () => mbApi.disconnect(),
      };

    case ProviderType.Ethers:
      const ethApi = (await connect()) as WebSocketProvider;
      return {
        name,
        api: ethApi,
        greet: async () =>
          debug(
            `👋  Provider ${name} is connected to chain ` +  (await ethApi.getNetwork()).chainId
          ),
        disconnect: () => {
          ethApi.removeAllListeners();
          ethApi.provider.destroy()
          ethApi.destroy();
        },
      };

      case ProviderType.Web3:
        const web3Api = (await connect()) as Web3;
        return {
          name,
          api: web3Api,
          greet: async () =>
            console.log(
              `👋 Provider ${name} is connected to chain ` + JSON.stringify(await web3Api.eth.getChainId())
            ),
          disconnect: () => {
            // console.log(web3Api.currentProvider)
            console.dir(ws, {depth: null})
            // console.log(web3Api.currentProvider)
          },
        };
  

      default:
        console.log(type)
        console.log(typeof type)
        throw new Error("UNKNOWN TYPE")
  }
}
