import type {
  MoonwallProvider,
  ProviderConfig,
  ProviderMap,
  ProviderType,
  ViemClient,
} from "@moonwall/types";
import {
  ALITH_PRIVATE_KEY,
  createLogger,
  deriveViemChain,
  normalizeUrlToHttps,
} from "@moonwall/util";
import { ApiPromise, WsProvider } from "@polkadot/api";
import type { ApiOptions } from "@polkadot/api/types";
import { Wallet, ethers } from "ethers";
import { createClient, type PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Web3 } from "web3";
import { WebSocketProvider } from "web3-providers-ws";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";
import * as fs from "node:fs";
import * as path from "node:path";
const logger = createLogger({ name: "providers" });
const debug = logger.debug.bind(logger);

/**
 * Get the metadata cache directory.
 * Uses MOONWALL_CACHE_DIR if set (from startup caching), otherwise defaults to tmp/metadata-cache.
 */
const getMetadataCacheDir = (): string => {
  return process.env.MOONWALL_CACHE_DIR || path.join(process.cwd(), "tmp", "metadata-cache");
};

/**
 * Load cached metadata if available, returns { genesisHash: metadataHex } or undefined
 */
const loadCachedMetadata = (): Record<string, `0x${string}`> | undefined => {
  const cacheDir = getMetadataCacheDir();
  const metadataPath = path.join(cacheDir, "metadata-cache.json");
  try {
    const data = fs.readFileSync(metadataPath, "utf-8");
    const cached = JSON.parse(data) as Record<string, `0x${string}`>;
    debug(`Loaded cached metadata for genesis: ${Object.keys(cached).join(", ")}`);
    return cached;
  } catch {
    return undefined;
  }
};

/**
 * Save metadata to cache for future connections
 */
const saveCachedMetadata = (genesisHash: string, metadataHex: string): void => {
  const cacheDir = getMetadataCacheDir();

  // Ensure cache directory exists
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
  } catch {
    // Directory might already exist or creation failed, try to continue
  }

  const metadataPath = path.join(cacheDir, "metadata-cache.json");
  const lockPath = `${metadataPath}.lock`;

  try {
    // Simple lock to prevent concurrent writes
    try {
      fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL);
    } catch {
      // Another process is writing, skip
      return;
    }

    const data = JSON.stringify({ [genesisHash]: metadataHex });
    fs.writeFileSync(metadataPath, data, "utf-8");
    debug(`Saved metadata cache for genesis: ${genesisHash}`);
  } catch (e) {
    debug(`Failed to save metadata cache: ${e}`);
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch {
      /* ignore */
    }
  }
};

export class ProviderFactory {
  private url: string;
  private privateKey: string;

  constructor(private providerConfig: ProviderConfig) {
    const endpoint = providerConfig.endpoints[0];
    // Support "AUTO" endpoint that uses dynamic MOONWALL_RPC_PORT
    if (endpoint === "AUTO" || endpoint.includes("ENV_VAR")) {
      this.url =
        endpoint === "AUTO"
          ? vitestAutoUrl()
          : process.env.WSS_URL || "error_missing_WSS_URL_env_var";
    } else {
      this.url = endpoint;
    }
    debug(`Constructor - providerConfig.endpoints[0]: ${endpoint}, this.url: ${this.url}`);
    this.privateKey = process.env.MOON_PRIV_KEY || ALITH_PRIVATE_KEY;
  }

  public create(): MoonwallProvider {
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

  private createPolkadotJs(): MoonwallProvider {
    debug(
      `🟢  PolkadotJs provider ${this.providerConfig.name} details prepared to connect to ${this.url}`
    );
    // Check if metadata caching is enabled (default: true)
    const cacheEnabled = this.providerConfig.cacheMetadata !== false;
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        const cachedMetadata = cacheEnabled ? loadCachedMetadata() : undefined;
        const startTime = Date.now();

        const options: ApiOptions = {
          provider: new WsProvider(this.url),
          initWasm: false,
          noInitWarn: true,
          isPedantic: false,
          rpc: this.providerConfig.rpc ? this.providerConfig.rpc : undefined,
          typesBundle: this.providerConfig.additionalTypes
            ? this.providerConfig.additionalTypes
            : undefined,
          metadata: cachedMetadata,
        };

        const api = await ApiPromise.create(options);
        await api.isReady;

        // Cache metadata for future connections if caching is enabled and not already cached
        if (cacheEnabled && !cachedMetadata) {
          const genesisHash = api.genesisHash.toHex();
          const metadataHex = api.runtimeMetadata.toHex();
          saveCachedMetadata(genesisHash, metadataHex);
          debug(`PolkadotJs connected in ${Date.now() - startTime}ms (metadata fetched & cached)`);
        } else if (cachedMetadata) {
          debug(`PolkadotJs connected in ${Date.now() - startTime}ms (using cached metadata)`);
        } else {
          debug(`PolkadotJs connected in ${Date.now() - startTime}ms (caching disabled)`);
        }

        return api;
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
        const provider = new WebSocketProvider(
          this.url,
          {},
          { delay: 50, autoReconnect: false, maxAttempts: 10 }
        );

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
        const provider = this.url.startsWith("ws")
          ? new ethers.WebSocketProvider(this.url)
          : new ethers.JsonRpcProvider(this.url);
        return new Wallet(this.privateKey, provider);
      },
    };
  }

  private createViem(): MoonwallProvider {
    debug(`🟢  Viem omni provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        try {
          debug(`Original URL (this.url): ${this.url}`);
          const httpUrl = normalizeUrlToHttps(this.url);
          debug(`Converted HTTP URL: ${httpUrl} for provider ${this.providerConfig.name}`);

          debug(
            `🔌 Attempting to derive chain for viem provider ${this.providerConfig.name} from ${httpUrl}`
          );
          const chain = await deriveViemChain(httpUrl);
          const client = createWalletClient({
            chain,
            account: privateKeyToAccount(this.privateKey as `0x${string}`),
            transport: http(httpUrl),
          }).extend(publicActions);
          return client;
        } catch (error: any) {
          console.error(
            `❌ Failed to create viem provider ${this.providerConfig.name} at ${this.url}: ${error.message}`
          );
          throw new Error(
            `Viem provider initialization failed for ${this.providerConfig.name} at ${this.url}: ${error.message}`
          );
        }
      },
    };
  }
  private createPapi(): MoonwallProvider {
    debug(`🟢  Papi provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        // Dev nodes in moonwall often sit idle between manual block builds, which means
        // the default 40s websocket heartbeat in polkadot-api can trigger false
        // disconnects. Relax the heartbeat so the connection remains up while the
        // test orchestrator drives block production.
        const provider = withPolkadotSdkCompat(getWsProvider(this.url, {}));
        return createClient(provider);
      },
    };
  }

  private createDefault(): MoonwallProvider {
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

  public static prepare(providerConfigs: ProviderConfig[]): MoonwallProvider[] {
    return providerConfigs.map((providerConfig) => new ProviderFactory(providerConfig).create());
  }

  public static prepareDefaultDev(): MoonwallProvider[] {
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

  public static prepareDefaultZombie(): MoonwallProvider[] {
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
    ] satisfies ProviderConfig[];

    if (MOON_PARA_WSS !== "error") {
      providers.push({
        name: "parachain",
        type: "polkadotJs",
        endpoints: [MOON_PARA_WSS],
      });
    }

    return ProviderFactory.prepare(providers);
  }

  public static prepareNoEthDefaultZombie(): MoonwallProvider[] {
    const MOON_PARA_WSS = process.env.MOON_PARA_WSS || "error";
    const MOON_RELAY_WSS = process.env.MOON_RELAY_WSS || "error";

    const providers = [
      {
        name: "relaychain",
        type: "polkadotJs",
        endpoints: [MOON_RELAY_WSS],
      },
    ] satisfies ProviderConfig[];

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

interface GenericProvider<T extends ProviderType> {
  name: string;
  api: ProviderMap[T];
  type: T;
  greet: () => Promise<void> | Promise<{ rtVersion: number; rtName: string }>;
  disconnect: () => void | Promise<void>;
}

export class ProviderInterfaceFactory {
  constructor(
    public name: string,
    public type: ProviderType,
    public connect: () =>
      | Promise<ApiPromise>
      | Wallet
      | Web3
      | Promise<ViemClient>
      | PolkadotClient
      | null
  ) {}

  public async create(): Promise<GenericProvider<this["type"]>> {
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

  private async createPolkadotJs(): Promise<GenericProvider<"polkadotJs">> {
    debug(`🔌 Connecting PolkadotJs provider: ${this.name}`);
    const api = (await this.connect()) as ApiPromise;
    debug(`✅ PolkadotJs provider ${this.name} connected`);
    1;
    return {
      name: this.name,
      api,
      type: "polkadotJs",
      greet: async () => {
        debug(
          `👋  Provider ${this.name} is connected to chain` +
            ` ${(api as any).consts.system.version.specName.toString()} ` +
            `RT${(api as any).consts.system.version.specVersion.toNumber()}`
        );
        return {
          rtVersion: (api as any).consts.system.version.specVersion.toNumber(),
          rtName: (api as any).consts.system.version.specName.toString(),
        };
      },
      disconnect: async () => api.disconnect(),
    };
  }

  private async createWeb3(): Promise<GenericProvider<"web3">> {
    const api = (await this.connect()) as Web3;
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

  private async createEthers(): Promise<GenericProvider<"ethers">> {
    const api = (await this.connect()) as Wallet;
    return {
      name: this.name,
      api,
      type: "ethers",
      greet: async () => {
        if (!api.provider) {
          throw new Error("No connected ethers provider to greet with");
        }
        debug(
          `👋  Provider ${this.name} is connected to chain ${
            (await api.provider.getNetwork()).chainId
          }`
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

  private async createViem(): Promise<GenericProvider<"viem">> {
    const api = (await this.connect()) as ViemClient;
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

  private async createPapi(): Promise<GenericProvider<"papi">> {
    const api = (await this.connect()) as PolkadotClient;
    return {
      name: this.name,
      api,
      type: "papi",
      greet: async () => {
        const unsafeApi = await api.getUnsafeApi();
        const { spec_version, spec_name } = await unsafeApi.constants.System.Version();
        return { rtVersion: spec_version as number, rtName: spec_name as string };
      },
      async disconnect() {
        api.destroy();
      },
    };
  }

  public static async populate(
    name: string,
    type: ProviderType,
    connect: () => Promise<ApiPromise> | Wallet | Web3 | Promise<ViemClient> | PolkadotClient | null
  ) {
    debug(`🔄 Populating provider: ${name} of type: ${type}`);
    try {
      const providerInterface = await new ProviderInterfaceFactory(name, type, connect).create();
      debug(`✅ Successfully populated provider: ${name}`);
      return providerInterface;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`❌ Failed to populate provider: ${name} - ${error.message}`);
      } else {
        console.error(`❌ Failed to populate provider: ${name} - Unknown error`);
      }
      throw error;
    }
  }
}

export const vitestAutoUrl = () => {
  const url = `ws://127.0.0.1:${process.env.MOONWALL_RPC_PORT}`;
  debug(
    `vitestAutoUrl - MOONWALL_RPC_PORT=${process.env.MOONWALL_RPC_PORT}, Generated URL: ${url}`
  );
  return url;
};
