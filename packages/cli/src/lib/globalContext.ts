import "@moonbeam-network/api-augment";
import {
  EthTransactionType,
  FoundationType,
  MoonwallConfig,
  ProviderConfig,
  ConnectedProvider,
  MoonwallEnvironment,
  MoonwallProvider,
} from "@moonwall/types";
import { ChildProcess, exec } from "node:child_process";
import { ProviderInterfaceFactory, ProviderFactory } from "../internal/providers.js";
import { launchNode } from "../internal/localNode.js";
import { setTimeout } from "node:timers/promises";
import { importJsonConfig } from "./configReader.js";
import { parseChopsticksRunCmd, parseRunCmd, parseZombieCmd } from "../internal/foundations.js";
import { ApiPromise } from "@polkadot/api";
import zombie, { Network } from "@zombienet/orchestrator";
import Debug from "debug";
import { checkZombieBins, getZombieConfig } from "../internal/foundations/zombieHelpers.js";
const debugSetup = Debug("global:context");

export const contextCreator = async (config: MoonwallConfig, env: string) => {
  const ctx = MoonwallContext.getContext(config);
  await runNetworkOnly(config);
  await ctx.connectEnvironment();
  return ctx;
};

export const runNetworkOnly = async (config: MoonwallConfig) => {
  const ctx = MoonwallContext.getContext(config);
  await ctx.startNetwork();
};

export const vitestAutoUrl = `ws://127.0.0.1:${
  10000 + Number(process.env.VITEST_POOL_ID || 1) * 100
}`;

const defaultConnections: ProviderConfig[] = [
  {
    name: "w3",
    type: "web3",
    endpoints: [vitestAutoUrl],
  },
  {
    name: "eth",
    type: "ethers",
    endpoints: [vitestAutoUrl],
  },
  {
    name: "public",
    type: "viemPublic",
    endpoints: [vitestAutoUrl],
  },
  {
    name: "wallet",
    type: "viemWallet",
    endpoints: [vitestAutoUrl],
  },
  {
    name: "mb",
    type: "moon",
    endpoints: [vitestAutoUrl],
  },
];

export class MoonwallContext {
  private static instance: MoonwallContext | undefined;
  environment!: MoonwallEnvironment;
  providers: ConnectedProvider[];
  nodes: ChildProcess[];
  foundation: FoundationType;
  zombieNetwork?: Network;
  private _finalizedHead?: string;
  rtUpgradePath?: string;
  defaultEthTxnStyle?: EthTransactionType;

  constructor(config: MoonwallConfig) {
    // this.environment;
    this.providers = [];
    this.nodes = [];

    const env = config.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
    const blob = {
      name: env.name,
      context: {},
      providers: [] as MoonwallProvider[],
      nodes: [] as {
        name?: string;
        cmd: string;
        args: string[];
        launch: boolean;
      }[],
      foundationType: env.foundation.type,
    };
    this.foundation = env.foundation.type;

    switch (env.foundation.type) {
      case "read_only":
        if (!env.connections) {
          throw new Error(
            `${env.name} env config is missing connections specification, required by foundation READ_ONLY`
          );
        } else {
          blob.providers = ProviderFactory.prepare(env.connections);
        }

        debugSetup(`🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`);
        break;

      case "chopsticks":
        blob.nodes.push(parseChopsticksRunCmd(env.foundation.launchSpec));
        blob.providers.push(...ProviderFactory.prepare(env.connections!));
        this.rtUpgradePath = env.foundation.rtUpgradePath;
        debugSetup(`🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`);
        break;

      case "dev":
        if (env.defaultEthTxnStyle) {
          this.defaultEthTxnStyle = env.defaultEthTxnStyle;
        }

        const { cmd, args, launch } = parseRunCmd(env.foundation.launchSpec[0]);
        blob.nodes.push({
          name: env.foundation.launchSpec[0].name,
          cmd,
          args,
          launch,
        });

        blob.providers = env.connections
          ? ProviderFactory.prepare(env.connections)
          : !!!env.foundation.launchSpec[0].disableDefaultEthProviders
          ? ProviderFactory.prepare(defaultConnections)
          : ProviderFactory.prepare([
              {
                name: "node",
                type: "polkadotJs",
                endpoints: [vitestAutoUrl],
              },
            ]);

        debugSetup(`🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`);
        break;

      case "zombie":
        const { cmd: zombieConfig } = parseZombieCmd(env.foundation.zombieSpec);
        blob.nodes.push({
          name: env.foundation.zombieSpec.name,
          cmd: zombieConfig,
          args: [],
          launch: true,
        });
        this.rtUpgradePath = env.foundation.rtUpgradePath;

        debugSetup(`🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`);
        break;

      default:
        debugSetup(`🚧  Foundation "${env.foundation.type}" unsupported, skipping`);
        return;
    }

    this.environment = blob;
  }

  public get genesis() {
    if (this._finalizedHead) {
      return this._finalizedHead;
    } else {
      return "";
    }
  }

  public set genesis(hash: string) {
    if (hash.length !== 66) {
      throw new Error("Cannot set genesis to invalid hash");
    }
    this._finalizedHead = hash;
  }

  public async startNetwork() {
    if (process.env.MOON_RECYCLE == "true") {
      debugSetup("Network has already been started, skipping command");
      return MoonwallContext.getContext();
    }

    const activeNodes = this.nodes.filter((node) => !node.killed);
    if (activeNodes.length > 0) {
      console.log("Nodes already started! Skipping command");
      return MoonwallContext.getContext();
    }
    const nodes = MoonwallContext.getContext().environment.nodes;

    if (this.environment.foundationType === "zombie") {
      console.log("🧟 Spawning zombie nodes ...");
      const config = await importJsonConfig();
      const env = config.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
      const zombieConfig = getZombieConfig(nodes[0].cmd);

      await checkZombieBins(zombieConfig);

      const network = await zombie.start("", zombieConfig, { silent: true });

      process.env.MOON_RELAY_WSS = network.relay[0].wsUri;
      process.env.MOON_PARA_WSS = Object.values(network.paras)[0].nodes[0].wsUri;

      if (
        env.foundation.type == "zombie" &&
        env.foundation.zombieSpec.monitoredNode &&
        env.foundation.zombieSpec.monitoredNode in network.nodesByName
      ) {
        process.env.MOON_MONITORED_NODE = `${network.tmpDir}/${env.foundation.zombieSpec.monitoredNode}.log`;
      }

      const processIds = Object.values((network.client as any).processMap)
        .filter((item) => item!["pid"])
        .map((process) => process!["pid"]);

      const onProcessExit = () => {
        exec(`kill -9 ${processIds.join(" ")}`, (error) => {
          if (error) {
            console.error(`Error killing process: ${error.message}`);
          }
        });
      };

      process.once("exit", onProcessExit);
      process.once("SIGINT", onProcessExit);

      process.env.MOON_MONITORED_NODE = zombieConfig.parachains[0].collator
        ? `${network.tmpDir}/${zombieConfig.parachains[0].collator.name}.log`
        : `${network.tmpDir}/${zombieConfig.parachains[0].collators![0].name}.log`;
      this.zombieNetwork = network;
      return;
    }

    const promises = nodes.map(async ({ cmd, args, name, launch }) => {
      return launch && this.nodes.push(await launchNode(cmd, args, name!));
    });
    await Promise.all(promises);
  }

  public async connectEnvironment(): Promise<MoonwallContext> {
    const config = await importJsonConfig();
    const env = config.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
    const MOON_PARA_WSS = process.env.MOON_PARA_WSS || "error";
    const MOON_RELAY_WSS = process.env.MOON_RELAY_WSS || "error";
    // TODO: Explicitly communicate (DOCs and console) this is done automatically
    if (this.environment.foundationType == "zombie") {
      this.environment.providers = env.connections
        ? ProviderFactory.prepare(env.connections)
        : ProviderFactory.prepare([
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
              name: "parachain",
              type: "moon",
              endpoints: [MOON_PARA_WSS],
            },
            {
              name: "relaychain",
              type: "polkadotJs",
              endpoints: [MOON_RELAY_WSS],
            },
          ]);
    }

    if (this.providers.length > 0) {
      return MoonwallContext.getContext();
    }

    const promises = this.environment.providers.map(
      async ({ name, type, connect }) =>
        new Promise(async (resolve) => {
          this.providers.push(await ProviderInterfaceFactory.populate(name, type, connect));
          resolve("");
        })
    );
    await Promise.all(promises);

    // TODO: Do we actually need this?
    if (this.foundation == "dev") {
      this.genesis = (
        await (
          this.providers.find(({ type }) => type == "polkadotJs" || type == "moon")!
            .api as ApiPromise
        ).rpc.chain.getBlockHash(0)
      ).toString();
    }

    if (this.foundation == "chopsticks") {
      this.genesis = (
        await (
          this.providers.find(({ type }) => type == "polkadotJs" || type == "moon")!
            .api as ApiPromise
        ).rpc.chain.getFinalizedHead()
      ).toString();
    }

    if (this.foundation == "zombie") {
      const promises = this.providers
        .filter(({ type }) => type == "polkadotJs" || type == "moon")
        .filter(
          ({ name }) =>
            env.foundation.type == "zombie" &&
            (!env.foundation.zombieSpec.skipBlockCheck ||
              !env.foundation.zombieSpec.skipBlockCheck.includes(name))
        )
        .map(async (provider) => {
          return await new Promise(async (resolve) => {
            console.log(`⏲️  Waiting for chain ${provider.name} to produce blocks...`);
            while (
              (
                await (provider.api as ApiPromise).rpc.chain.getBlock()
              ).block.header.number.toNumber() == 0
            ) {
              await setTimeout(500);
            }
            console.log(`✅ Chain ${provider.name} producing blocks, continuing`);
            resolve("");
          });
        });

      await Promise.all(promises);
    }

    return MoonwallContext.getContext();
  }

  public async disconnect(providerName?: string) {
    if (providerName) {
      this.providers.find(({ name }) => name === providerName)!.disconnect();
      this.providers.filter(({ name }) => name !== providerName);
    } else {
      await Promise.all(this.providers.map((prov) => prov.disconnect()));
      this.providers = [];
    }
  }

  public static printStats() {
    if (MoonwallContext) {
      console.dir(MoonwallContext.getContext(), { depth: 1 });
    } else {
      console.log("Global context not created!");
    }
  }

  public static getContext(config?: MoonwallConfig, force: boolean = false): MoonwallContext {
    if (!MoonwallContext.instance || force) {
      // Retrieves the instance from the global context if it exists.
      // if (global.moonInstance && !force) {
      //   MoonwallContext.instance = global.moonInstance;
      //   return MoonwallContext.instance;
      // }
      if (!config) {
        console.error("❌ Config must be provided on Global Context instantiation");
        process.exit(2);
        // return undefined;
      }
      MoonwallContext.instance = new MoonwallContext(config);

      debugSetup(`🟢  Moonwall context "${config.label}" created`);
    }
    return MoonwallContext.instance;
  }

  public static async destroy() {
    const ctx = MoonwallContext.getContext();
    try {
      ctx.disconnect();
    } catch {
      console.log("🛑  All connections disconnected");
    }
    const promises = ctx.nodes.map((process) => {
      return new Promise((resolve) => {
        process.kill();
        if (process.killed) {
          resolve(`process ${process.pid} killed`);
        }
      });
    });

    await Promise.all(promises);

    if (!!ctx.zombieNetwork) {
      console.log("🪓  Killing zombie nodes");
      await ctx.zombieNetwork.stop();
    }
  }
}
