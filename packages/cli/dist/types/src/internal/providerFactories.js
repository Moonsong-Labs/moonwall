import { ALITH_PRIVATE_KEY, deriveViemChain } from "@moonwall/util";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Wallet, ethers } from "ethers";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Web3 } from "web3";
import { WebSocketProvider } from "web3-providers-ws";
import { createClient } from "polkadot-api";
import { getWsProvider, WsEvent } from "polkadot-api/ws-provider/web";
import { createLogger } from "@moonwall/util";
const logger = createLogger({ name: "providers" });
const debug = logger.debug.bind(logger);
export class ProviderFactory {
  providerConfig;
  url;
  privateKey;
  constructor(providerConfig) {
    this.providerConfig = providerConfig;
    this.url = providerConfig.endpoints.includes("ENV_VAR")
      ? process.env.WSS_URL || "error_missing_WSS_URL_env_var"
      : providerConfig.endpoints[0];
    this.privateKey = process.env.MOON_PRIV_KEY || ALITH_PRIVATE_KEY;
  }
  create() {
    switch (this.providerConfig.type) {
      case "polkadotJs":
        return this.createPolkadotJs();
      case "web3":
        return this.createWeb3();
      case "ethers":
        return this.createEthers();
      case "viem":
        return this.createViem();
      case "papi":
        return this.createPapi();
      default:
        return this.createDefault();
    }
  }
  createPolkadotJs() {
    debug(`🟢  PolkadotJs provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        process.env.DEFAULT_TIMEOUT_MS = "30000";
        const options = {
          provider: new WsProvider(this.url),
          initWasm: false,
          noInitWarn: true,
          isPedantic: false,
          rpc: this.providerConfig.rpc ? this.providerConfig.rpc : undefined,
          typesBundle: this.providerConfig.additionalTypes
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
  createWeb3() {
    debug(`🟢  Web3 provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = new WebSocketProvider(
          this.url,
          {},
          { delay: 50, autoReconnect: false, maxAttempts: 10 }
        );
        return new Web3(provider);
      },
    };
  }
  createEthers() {
    debug(`🟢  Ethers provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = this.url.startsWith("ws")
          ? new ethers.WebSocketProvider(this.url)
          : new ethers.JsonRpcProvider(this.url);
        return new Wallet(this.privateKey, provider);
      },
    };
  }
  createViem() {
    debug(`🟢  Viem omni provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        try {
          debug(
            `🔌 Attempting to derive chain for viem provider ${this.providerConfig.name} from ${this.url}`
          );
          const chain = await deriveViemChain(this.url);
          const client = createWalletClient({
            chain,
            account: privateKeyToAccount(this.privateKey),
            transport: http(this.url.replace("ws", "http")),
          }).extend(publicActions);
          return client;
        } catch (error) {
          console.error(
            `❌ Failed to create viem provider ${this.providerConfig.name}: ${error.message}`
          );
          throw new Error(
            `Viem provider initialization failed for ${this.providerConfig.name}: ${error.message}`
          );
        }
      },
    };
  }
  createPapi() {
    debug(`🟢  Papi provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = getWsProvider(this.url, (status) => {
          switch (status.type) {
            case WsEvent.CONNECTING:
              console.log("Connecting... 🔌");
              break;
            case WsEvent.CONNECTED:
              console.log("Connected! ⚡");
              break;
            case WsEvent.ERROR:
              console.log("Errored... 😢");
              break;
            case WsEvent.CLOSE:
              console.log("Closed 🚪");
              break;
          }
        });
        return createClient(provider);
      },
    };
  }
  createDefault() {
    debug(`🟢  Default provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        console.log(`🚧  provider ${this.providerConfig.name} not yet implemented`);
        return null;
      },
    };
  }
  static prepare(providerConfigs) {
    return providerConfigs.map((providerConfig) => new ProviderFactory(providerConfig).create());
  }
  static prepareDefaultDev() {
    return ProviderFactory.prepare([
      {
        name: "dev",
        type: "polkadotJs",
        endpoints: [vitestAutoUrl()],
      },
      {
        name: "w3",
        type: "web3",
        endpoints: [vitestAutoUrl()],
      },
      {
        name: "eth",
        type: "ethers",
        endpoints: [vitestAutoUrl()],
      },
      {
        name: "public",
        type: "viem",
        endpoints: [vitestAutoUrl()],
      },
    ]);
  }
  static prepareDefaultZombie() {
    const MOON_PARA_WSS = process.env.MOON_PARA_WSS || "error";
    const MOON_RELAY_WSS = process.env.MOON_RELAY_WSS || "error";
    const providers = [
      {
        name: "w3",
        type: "web3",
        endpoints: [MOON_PARA_WSS],
      },
      {
        name: "eth",
        type: "ethers",
        endpoints: [MOON_PARA_WSS],
      },
      {
        name: "viem",
        type: "viem",
        endpoints: [MOON_PARA_WSS],
      },
      {
        name: "relaychain",
        type: "polkadotJs",
        endpoints: [MOON_RELAY_WSS],
      },
    ];
    if (MOON_PARA_WSS !== "error") {
      providers.push({
        name: "parachain",
        type: "polkadotJs",
        endpoints: [MOON_PARA_WSS],
      });
    }
    return ProviderFactory.prepare(providers);
  }
  static prepareNoEthDefaultZombie() {
    const MOON_PARA_WSS = process.env.MOON_PARA_WSS || "error";
    const MOON_RELAY_WSS = process.env.MOON_RELAY_WSS || "error";
    const providers = [
      {
        name: "relaychain",
        type: "polkadotJs",
        endpoints: [MOON_RELAY_WSS],
      },
    ];
    if (MOON_PARA_WSS !== "error") {
      providers.push({
        name: "parachain",
        type: "polkadotJs",
        endpoints: [MOON_PARA_WSS],
      });
    }
    return ProviderFactory.prepare(providers);
  }
}
export class ProviderInterfaceFactory {
  name;
  type;
  connect;
  constructor(name, type, connect) {
    this.name = name;
    this.type = type;
    this.connect = connect;
  }
  async create() {
    switch (this.type) {
      case "polkadotJs":
        return this.createPolkadotJs();
      case "web3":
        return this.createWeb3();
      case "ethers":
        return this.createEthers();
      case "viem":
        return this.createViem();
      case "papi":
        return this.createPapi();
      default:
        throw new Error("UNKNOWN TYPE");
    }
  }
  async createPolkadotJs() {
    debug(`🔌 Connecting PolkadotJs provider: ${this.name}`);
    const api = await this.connect();
    debug(`✅ PolkadotJs provider ${this.name} connected`);
    1;
    return {
      name: this.name,
      api,
      type: "polkadotJs",
      greet: async () => {
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
  async createWeb3() {
    const api = await this.connect();
    return {
      name: this.name,
      api,
      type: "web3",
      greet: async () =>
        console.log(`👋 Provider ${this.name} is connected to chain ${await api.eth.getChainId()}`),
      disconnect: async () => {
        if (!api.eth.net.currentProvider) {
          throw new Error("No connected web3 provider to disconnect from");
        }
        api.eth.net.currentProvider.disconnect();
      },
    };
  }
  async createEthers() {
    const api = await this.connect();
    return {
      name: this.name,
      api,
      type: "ethers",
      greet: async () => {
        if (!api.provider) {
          throw new Error("No connected ethers provider to greet with");
        }
        debug(
          `👋  Provider ${this.name} is connected to chain ${(await api.provider.getNetwork()).chainId}`
        );
      },
      disconnect: () => {
        if (!api.provider) {
          throw new Error("No connected ethers provider to disconnect from");
        }
        api.provider.destroy();
      },
    };
  }
  async createViem() {
    const api = await this.connect();
    return {
      name: this.name,
      api,
      type: "viem",
      greet: async () =>
        console.log(`👋 Provider ${this.name} is connected to chain ${await api.getChainId()}`),
      disconnect: async () => {
        // Not needed until we switch to websockets
      },
    };
  }
  async createPapi() {
    const api = await this.connect();
    return {
      name: this.name,
      api,
      type: "papi",
      greet: async () => {
        const unsafeApi = await api.getUnsafeApi();
        const { spec_version, spec_name } = await unsafeApi.constants.System.Version();
        return { rtVersion: spec_version, rtName: spec_name };
      },
      async disconnect() {
        api.destroy();
      },
    };
  }
  static async populate(name, type, connect) {
    debug(`🔄 Populating provider: ${name} of type: ${type}`);
    try {
      const providerInterface = await new ProviderInterfaceFactory(name, type, connect).create();
      debug(`✅ Successfully populated provider: ${name}`);
      return providerInterface;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ Failed to populate provider: ${name} - ${error.message}`);
      } else {
        console.error(`❌ Failed to populate provider: ${name} - Unknown error`);
      }
      throw error;
    }
  }
}
export const vitestAutoUrl = () => `ws://127.0.0.1:${process.env.MOONWALL_RPC_PORT}`;
//# sourceMappingURL=providerFactories.js.map
