import { rpcDefinitions, types } from "moonbeam-types-bundle";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Web3 } from "web3";
import { WebSocketProvider as Web3ProviderWs } from "web3-providers-ws";
import { ethers, Signer, Wallet } from "ethers";
import Debug from "debug";
import {
  ProviderConfig,
  ProviderType,
  MoonwallProvider,
  PublicViem,
  WalletViem,
} from "@moonwall/types";
import chalk from "chalk";
import { ALITH_PRIVATE_KEY } from "@moonwall/util";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deriveViemChain } from "@moonwall/util";
import { ApiOptions } from "@polkadot/api/types/index.js";
import { OverrideBundleType } from "@polkadot/types/types/registry";
const debug = Debug("global:providers");

class ProviderFactory {
  private url: string;
  private privateKey: string;

  constructor(private providerConfig: ProviderConfig) {
    this.url = providerConfig.endpoints.includes("ENV_VAR")
      ? process.env.WSS_URL!
      : providerConfig.endpoints[0];
    this.privateKey = process.env.MOON_PRIV_KEY || ALITH_PRIVATE_KEY;
  }

  public create(): MoonwallProvider {
    switch (this.providerConfig.type) {
      case "polkadotJs":
        return this.createPolkadotJs();
      case "moon":
        return this.createMoon();
      case "web3":
        return this.createWeb3();
      case "ethers":
        return this.createEthers();
      case "viemPublic":
        return this.createViemPublic();
      case "viemWallet":
        return this.createViemWallet();
      default:
        return this.createDefault();
    }
  }

  private createPolkadotJs(): MoonwallProvider {
    debug(`🟢  PolkadotJs provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        const options: ApiOptions = {
          provider: new WsProvider(this.url),
          initWasm: false,
          noInitWarn: true,
          rpc: !!this.providerConfig.rpc ? this.providerConfig.rpc : undefined,
          typesBundle: !!this.providerConfig.additionalTypes
            ? this.providerConfig.additionalTypes
            : undefined,
        };

        const api = await ApiPromise.create(options);
        await api.isReady;
        return api;
      },
      ws: () => new WsProvider(this.url),
    };
  }

  private createMoon(): MoonwallProvider {
    debug(`🟢  Moonbeam provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        const options: ApiOptions = {
          provider: new WsProvider(this.url),
          initWasm: false,
          isPedantic: false,
          rpc: !!this.providerConfig.rpc
            ? { ...rpcDefinitions, ...this.providerConfig.rpc }
            : rpcDefinitions,
          typesBundle: !!this.providerConfig.additionalTypes
            ? { ...(types as OverrideBundleType), ...this.providerConfig.additionalTypes }
            : (types as OverrideBundleType),
          noInitWarn: true,
        };

        const moonApi = await ApiPromise.create(options);
        await moonApi.isReady;
        return moonApi;
      },
      ws: () => new WsProvider(this.url),
    };
  }

  private createWeb3(): MoonwallProvider {
    debug(`🟢  Web3 provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = new Web3ProviderWs(
          this.url,
          {},
          { delay: 50, autoReconnect: false, maxAttempts: 10 }
        );

        provider.on("error", () => {
          throw new Error(
            `Cannot connect to Web3 provider ${chalk.bgWhiteBright.blackBright(this.url)}`
          );
        });

        return new Web3(provider);
      },
    };
  }

  private createEthers(): MoonwallProvider {
    debug(`🟢  Ethers provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = new ethers.WebSocketProvider(this.url);
        return new Wallet(this.privateKey, provider);
      },
    };
  }

  private createViemPublic(): MoonwallProvider {
    debug(`🟢  Viem Public provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () =>
        createPublicClient({
          transport: http(this.url.replace("ws", "http")),
        }) as PublicViem,
    };
  }

  private createViemWallet(): MoonwallProvider {
    debug(`🟢  Viem Wallet provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () =>
        createWalletClient({
          chain: await deriveViemChain(this.url),
          account: privateKeyToAccount(this.privateKey as `0x${string}`),
          transport: http(this.url.replace("ws", "http")),
        }) as WalletViem,
    };
  }

  private createDefault(): MoonwallProvider {
    debug(`🟢  Default provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => console.log(`🚧  provider ${this.providerConfig.name} not yet implemented`),
    };
  }
}

export function prepareProviders(providerConfigs: ProviderConfig[]): MoonwallProvider[] {
  return providerConfigs.map((providerConfig) => new ProviderFactory(providerConfig).create());
}

interface ProviderInterface {
  name: string;
  api: any;
  type: ProviderType;
  greet: () => void | Promise<void> | { rtVersion: number; rtName: string };
  disconnect: () => void | Promise<void> | any;
}

class ProviderInterfaceFactory {
  constructor(private name: string, private type: ProviderType, private connect: () => any) {}

  public async create(): Promise<ProviderInterface> {
    switch (this.type) {
      case "polkadotJs":
        return this.createPolkadotJs();
      case "moon":
        return this.createMoon();
      case "web3":
        return this.createWeb3();
      case "ethers":
        return this.createEthers();
      case "viemPublic":
        return this.createViemPublic();
      case "viemWallet":
        return this.createViemWallet();
      default:
        throw new Error("UNKNOWN TYPE");
    }
  }

  private async createPolkadotJs(): Promise<ProviderInterface> {
    const api = (await this.connect()) as ApiPromise;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: () => {
        debug(
          `👋  Provider ${this.name} is connected to chain` +
            ` ${api.consts.system.version.specName.toString()} ` +
            `RT${api.consts.system.version.specVersion.toNumber()}`
        );
        return {
          rtVersion: api.consts.system.version.specVersion.toNumber(),
          rtName: api.consts.system.version.specName.toString(),
        };
      },
      disconnect: async () => api.disconnect(),
    };
  }

  private async createMoon(): Promise<ProviderInterface> {
    const api = (await this.connect()) as ApiPromise;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: () => {
        debug(
          `👋  Provider ${this.name} is connected to chain` +
            ` ${api.consts.system.version.specName.toString()} ` +
            `RT${api.consts.system.version.specVersion.toNumber()}`
        );
        return {
          rtVersion: api.consts.system.version.specVersion.toNumber(),
          rtName: api.consts.system.version.specName.toString(),
        };
      },
      disconnect: async () => api.disconnect(),
    };
  }

  private async createWeb3(): Promise<ProviderInterface> {
    const api = (await this.connect()) as Web3;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: async () =>
        console.log(
          `👋 Provider ${this.name} is connected to chain ` + (await api.eth.getChainId())
        ),
      disconnect: async () => {
        api.currentProvider!.disconnect();
      },
    };
  }

  private async createEthers(): Promise<ProviderInterface> {
    const api = (await this.connect()) as Signer;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: async () =>
        debug(
          `👋  Provider ${this.name} is connected to chain ` +
            (await api.provider!.getNetwork()).chainId
        ),
      disconnect: async () => api.provider!.destroy(),
    };
  }

  private async createViemPublic(): Promise<ProviderInterface> {
    const api = (await this.connect()) as PublicViem;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: async () =>
        console.log(`👋 Provider ${this.name} is connected to chain ` + (await api.getChainId())),
      disconnect: async () => {
        // Not needed until we switch to websockets
      },
    };
  }

  private async createViemWallet(): Promise<ProviderInterface> {
    const api = (await this.connect()) as WalletViem;
    return {
      name: this.name,
      api,
      type: this.type,
      greet: async () =>
        console.log(`👋 Provider ${this.name} is connected to chain ` + (await api.getChainId())),
      disconnect: async () => {
        // Not needed until we switch to websockets
      },
    };
  }
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
): Promise<ProviderInterface> {
  return await new ProviderInterfaceFactory(name, type, connect).create();
}