import {
  rpcDefinitions,
  types,
} from "moonbeam-types-bundle";
import { ApiPromise, WsProvider } from "@polkadot/api";
import {Web3BaseProvider} from "web3-types"
import Web3 from "web3";
import {
  ConnectedProvider,
  LaunchedNode,
  MoonwallConfig,
  MoonwallEnvironment,
  MoonwallProvider,
  ProviderConfig,
  ProviderType,
} from "../lib/types";
import { ApiOptions } from "@polkadot/api/types";
import { WebSocketProvider } from "ethers";
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
        return {
          name,
          type,
          connect: async () => {
            const ethApi = new Web3(new Web3.providers.WebsocketProvider(url))
            return ethApi;
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
  connect: () => Promise<ApiPromise> | Promise<WebSocketProvider> |Web3 | void
) {
  switch (type) {
    case ProviderType.PolkadotJs:
      const pjsApi = (await connect()) as ApiPromise;
      return {
        name,
        api: pjsApi,
        greet: () =>
          console.log(
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
          console.log(
            `👋  Provider ${name} is connected to chain` +
              ` ${mbApi.consts.system.version.specName.toString()} ` +
              `RT${mbApi.consts.system.version.specVersion.toNumber()}`
          ),
        disconnect: () => mbApi.disconnect(),
      };

    case ProviderType.Ethers:
      const ethApi = (await connect()) as WebSocketProvider;
      // console.log(ethApi)
      console.dir(connect, {depth:2})
      return {
        name,
        api: ethApi,
        greet: async () =>
          console.log(
            `👋 Provider ${name} is connected to chain ` + JSON.stringify(await ethApi.getNetwork())
          ),
        disconnect: () => {
          ethApi.removeAllListeners();
          ethApi.destroy();
        },
      };

      case ProviderType.Web3:
        const web3Api = (await connect()) as Web3;
        // console.log(ethApi)
        // console.dir(connect, {depth:2})
        return {
          name,
          api: web3Api,
          greet: async () =>
            console.log(
              `👋 Provider ${name} is connected to chain ` + JSON.stringify(await web3Api.eth.getChainId())
            ),
          disconnect: () => {
            // web3Api.removeAllListeners();
            // await web3Api.eth.currentProvider.disconnect()
          },
        };
  

      default:
        console.log(type)
        console.log(typeof type)
        throw new Error("UNKNOWN TYPE")
  }
}
