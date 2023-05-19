import { rpcDefinitions, types } from "moonbeam-types-bundle";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Web3 } from "web3";
import { WebSocketProvider as Web3ProviderWs } from "web3-providers-ws";
import { ethers, Signer, Wallet } from "ethers";
import Debug from "debug";
import { ProviderConfig, ProviderType } from "../types/config.js";
import { MoonwallProvider } from "../types/context.js";
import chalk from "chalk";
import { Abi } from "abitype";
import { ALITH_PRIVATE_KEY } from "@moonwall/util";
import {
  PublicClient,
  Transport,
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { moonbeam, moonbaseAlpha, moonriver, Chain } from "viem/chains";
import { PublicViem, WalletViem } from "../types/runner.js";
import { getDevChain } from "../lib/viem.js";
import { ApiOptions } from "@polkadot/api/types/index.js";
const debug = Debug("global:providers");

export function prepareProviders(providerConfigs: ProviderConfig[]): MoonwallProvider[] {
  return providerConfigs.map(({ name, endpoints, type, rpc }) => {
    const url = endpoints.includes("ENV_VAR") ? process.env.WSS_URL! : endpoints[0];
    const privateKey = process.env.MOON_PRIV_KEY || ALITH_PRIVATE_KEY;

    switch (type) {
      case "polkadotJs":
        debug(`🟢  PolkadotJs provider ${name} details prepared`);
        return {
          name,
          type,
          connect: async () => {
            const options = {
              provider: new WsProvider(url),
              initWasm: false,
              noInitWarn: true,
            };

            if (!!rpc) {
              options["rpc"] = rpc;
            }

            const api = await ApiPromise.create(options);
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
            const options = {
              provider: new WsProvider(url),
              rpc: rpcDefinitions,
              typesBundle: types,
              noInitWarn: true,
            };

            if (!!rpc) {
              options["rpc"] = { ...rpc };
            }

            const moonApi = await ApiPromise.create(options as ApiOptions);
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
            const provider = new Web3ProviderWs(
              url,
              {},
              { delay: 50, autoReconnect: false, maxAttempts: 10 }
            );

            provider.on("error", () => {
              throw new Error(
                `Cannot connect to Web3 provider ${chalk.bgWhiteBright.blackBright(url)}`
              );
            });

            return new Web3(provider);
          },
        };

      case "ethers":
        debug(`🟢  Ethers provider ${name} details prepared`);
        return {
          name,
          type,
          connect: () => {
            const provider = new ethers.WebSocketProvider(url);
            return new Wallet(privateKey, provider);
          },
        };

      case "viemPublic":
        debug(`🟢  Viem Public provider ${name} details prepared`);
        return {
          name,
          type,
          connect: async () =>
            createPublicClient({
              transport: http(url.replace("ws", "http")),
            }),
        };

      case "viemWallet":
        return {
          name,
          type,
          connect: async () =>
            createWalletClient({
              chain: await getDevChain(url),
              account: privateKeyToAccount(privateKey as `0x${string}`),
              transport: http(url.replace("ws", "http")),
            }),
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

export async function populateProviderInterface(
  name: string,
  type: ProviderType,
  connect: () =>
    | Promise<ApiPromise>
    | Signer
    | Web3
    | Promise<PublicViem>
    | Promise<WalletViem>
    | void
): Promise<{
  name: string;
  api: any;
  type: ProviderType;
  greet: () => void | Promise<void> | { rtVersion: number; rtName: string };
  disconnect: () => void | Promise<void> | any
}> {
  switch (type) {
    case "polkadotJs":
      const pjsApi = (await connect()) as ApiPromise;
      return {
        name,
        api: pjsApi,
        type,
        greet: () => {
          debug(
            `👋  Provider ${name} is connected to chain` +
              ` ${pjsApi.consts.system.version.specName.toString()} ` +
              `RT${pjsApi.consts.system.version.specVersion.toNumber()}`
          );
          return {
            rtVersion: pjsApi.consts.system.version.specVersion.toNumber(),
            rtName: pjsApi.consts.system.version.specName.toString(),
          };
        },
        disconnect: async () => pjsApi.disconnect(),
      };

    case "moon":
      const mbApi = (await connect()) as ApiPromise;
      return {
        name,
        api: mbApi,
        type,
        greet: () => {
          debug(
            `👋  Provider ${name} is connected to chain` +
              ` ${mbApi.consts.system.version.specName.toString()} ` +
              `RT${mbApi.consts.system.version.specVersion.toNumber()}`
          );
          return {
            rtVersion: mbApi.consts.system.version.specVersion.toNumber(),
            rtName: mbApi.consts.system.version.specName.toString(),
          };
        },
        disconnect: async () => mbApi.disconnect(),
      };

    case "ethers":
      const ethApi = (await connect()) as Signer;
      return {
        name,
        api: ethApi,
        type,
        greet: async () =>
          debug(
            `👋  Provider ${name} is connected to chain ` +
              (await ethApi.provider!.getNetwork()).chainId
          ),
        disconnect: async () => 
          ethApi.provider!.destroy()
        
      };

    case "web3":
      const web3Api = (await connect()) as Web3;
      return {
        name,
        api: web3Api,
        type,
        greet: async () =>
          console.log(
            `👋 Provider ${name} is connected to chain ` + (await web3Api.eth.getChainId())
          ),
        disconnect: async () => {
          web3Api.currentProvider!.disconnect();
        },
      };
    case "viemPublic":
      const pubClient = (await connect()) as PublicViem;
      return {
        name,
        api: pubClient,
        type,
        greet: async () =>
          console.log(
            `👋 Provider ${name} is connected to chain ` + (await pubClient.getChainId())
          ),
        disconnect: async () => {
          // TODO: add disconnect
        },
      };

    case "viemWallet":
      const wallClient = (await connect()) as WalletViem;
      return {
        name,
        api: wallClient,
        type,
        greet: async () =>
          console.log(
            `👋 Provider ${name} is connected to chain ` + (await wallClient.getChainId())
          ),
        disconnect: async () => {
          //TODO: add disconnect
        },
      };

    default:
      throw new Error("UNKNOWN TYPE");
  }
}
