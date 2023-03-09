import { rpcDefinitions, types } from "moonbeam-types-bundle";
import { ApiPromise, WsProvider } from "@polkadot/api";
import Web3 from "web3";
import { ethers } from "ethers";
import { WebSocketProvider } from "ethers";
import Debug from "debug";
import { ProviderConfig, ProviderType } from "../types/config.js";
import { MoonwallProvider } from "../types/context.js";
const debug = Debug("global:providers");

export function prepareProviders(
  providerConfigs: ProviderConfig[]
): MoonwallProvider[] {
  return providerConfigs.map(({ name, endpoints, type }) => {
    const url = endpoints.includes("ENV_VAR")
      ? process.env.WSS_URL!
      : endpoints[0];

    switch (type) {
      case "polkadotJs":
        debug(`🟢  PolkadotJs provider ${name} details prepared`);
        return {
          name,
          type,
          connect: async () => {
            const api = await ApiPromise.create({
              provider: new WsProvider(url),
              initWasm: false,
              noInitWarn: true,
            });
            await api.isReady;
            return api;
          },
          ws: () => new WsProvider(url),
        };

      case "moon":
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
          ws: () => new WsProvider(url),
        };

      case "web3":
        debug(`🟢  Web3 provider ${name} details prepared`);
        return {
          name,
          type,
          connect: () => {
            const wsProvider =
              new Web3.providers.WebsocketProvider(url);
            const ethApi = new Web3(wsProvider);
            return ethApi;
          },
        };

      case "ethers":
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
          connect: () =>
            console.log(`🚧  provider ${name} not yet implemented`),
        };
    }
  });
}

export async function populateProviderInterface(
  name: string,
  type: ProviderType,
  connect: () => Promise<ApiPromise> | Promise<WebSocketProvider> | Web3 | void,
  ws?: () => void
) {
  switch (type) {
    case "polkadotJs":
      const pjsApi = (await connect()) as ApiPromise;
      return {
        name,
        api: pjsApi,
        type,
        greet: () =>
          debug(
            `👋  Provider ${name} is connected to chain` +
              ` ${(pjsApi.consts.system.version as any).specName.toString()} ` +
              `RT${(
                pjsApi.consts.system.version as any
              ).specVersion.toNumber()}`
          ),
        disconnect: async () => pjsApi.disconnect(),
      };

    case "moon":
      const mbApi = (await connect()) as ApiPromise;
      return {
        name,
        api: mbApi,
        type,
        greet: () =>
          debug(
            `👋  Provider ${name} is connected to chain` +
              ` ${(mbApi.consts.system.version as any).specName.toString()} ` +
              `RT${(mbApi.consts.system.version as any).specVersion.toNumber()}`
          ),
        disconnect: async () => mbApi.disconnect(),
      };

    case "ethers":
      const ethApi = (await connect()) as WebSocketProvider;
      return {
        name,
        api: ethApi,
        type,
        greet: async () =>
          debug(
            `👋  Provider ${name} is connected to chain ` +
              (await ethApi.getNetwork()).chainId
          ),
        disconnect: async () => {
          ethApi.removeAllListeners();
          ethApi.provider.destroy();
        },
      };

    case "web3":
      const web3Api = (await connect()) as Web3;
      return {
        name,
        api: web3Api,
        type,
        greet: async () =>
          console.log(
            `👋 Provider ${name} is connected to chain ` +
              (await web3Api.eth.getChainId())
          ),
        disconnect: async () => {
          // @ts-ignore
          web3Api.currentProvider.disconnect(1000);
        },
      };

    default:
      throw new Error("UNKNOWN TYPE");
  }
}
