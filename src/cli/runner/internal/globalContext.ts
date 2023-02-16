import {
  ConnectedProvider,
  FoundationType,
  MoonwallConfig,
  MoonwallEnvironment,
  Node,
  ProviderType,
} from "../lib/types";

// import { globalConfig } from "../../../../moonwalls.config";
import { ChildProcess, spawn } from "child_process";
import { populateProviderInterface, prepareProviders } from "../util/providers.js";
import { launchDevNode } from "../util/LocalNode.js";
import globalConfig from "../../../../moonwall.config.js";
import { parseRunCmd } from "./devFoundation.js";
import { ApiPromise } from "@polkadot/api";
import Debug from "debug"
const debugSetup = Debug("global:context");
const debugNode = Debug("global:node");

export class MoonwallContext {
  private static instance: MoonwallContext;
  environments: MoonwallEnvironment[];
  providers: ConnectedProvider[];
  nodes: ChildProcess[];
  foundation?: FoundationType;
  private _genesis?: string;

  constructor(config: MoonwallConfig) {
    this.environments = [];
    this.providers = [];
    this.nodes = [];

    config.environments.forEach((env) => {
      const blob = { name: env.name, context: {}, providers: [], nodes: [] };

      switch (env.foundation.type) {
        case FoundationType.ReadOnly:
          if (!env.connections) {
            throw new Error(
              `${env.name} env config is missing connections specification, required by foundation READ_ONLY`
            );
          } else {
            blob.providers = prepareProviders(env.connections);
          }

          debugSetup(
            `🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`
          );
          break;

        case FoundationType.DevMode:
          const { cmd, args } = parseRunCmd(env.foundation.launchSpec[0]);
          // debugNode(`The run command is: ${cmd}`);
          // debugNode(`The run args are: ${args}`);

          blob.nodes.push({
            name: env.foundation.launchSpec[0].bin.name,
            cmd,
            args,
          });

          blob.providers = env.connections
            ? prepareProviders(env.connections)
            : prepareProviders([
                {
                  name: "w3",
                  type: ProviderType.Web3,
                  endpoints: ["ws://localhost:9944"],
                },
                {
                  name: "eth",
                  type: ProviderType.Ethers,
                  endpoints: ["ws://localhost:9944"],
                },
                {
                  name: "polka",
                  type: ProviderType.PolkadotJs,
                  endpoints: ["ws://localhost:9944"],
                },
              ]);

          debugSetup(
            `🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`
          );
          break;
        default:
          debugSetup(
            `🚧  Foundation "${env.foundation.type}" unsupported, skipping`
          );
          return;
      }
      this.environments.push(blob);
    });
  }

  public get genesis(){
    return this._genesis
  }

  public set genesis(hash: string){
    if (hash.length !== 66){
      throw new Error("Cannot set genesis to invalid hash")
    }
    this._genesis=hash
  }

  public async startNetwork(environmentName: string) {
    if (this.nodes.length > 0) {
      console.log("Nodes already started! Skipping command");
      return MoonwallContext.getContext();
    }

    const nodes = MoonwallContext.getContext().environments.find(
      (env) => env.name == environmentName
    ).nodes;
    const promises = nodes.map(async ({ cmd, args, name }) => {
      await launchDevNode(cmd, args, name);
    });

    await Promise.all(promises);
  }

  public env(query: string): MoonwallEnvironment | undefined {
    return this.environments.find(({ name }) => name == query);
  }

  public async connectEnvironment(environmentName: string) {
    if (this.providers.length > 0) {
      console.log("Providers already connected! Skipping command");
      return MoonwallContext.getContext();
    }

    const promises = this.environments
      .find(({ name }) => name === environmentName)
      .providers.map(
        async ({ name, type, connect, ws }) =>
          new Promise(async (resolve) => {
            const providerDetails = ws
              ? await populateProviderInterface(name, type, connect, ws)
              : await populateProviderInterface(name, type, connect);
            this.providers.push(providerDetails);
            resolve("");
          })
      );
    await Promise.all(promises);

    this.foundation = globalConfig.environments.find(
      ({ name }) => name == environmentName
    ).foundation.type;

    if (this.foundation == FoundationType.DevMode) {
      this.genesis = (
        await (
          this.providers.find(
            ({ type }) =>
              type == ProviderType.PolkadotJs || type == ProviderType.Moonbeam
          ).api as ApiPromise
        ).rpc.chain.getBlockHash(0)
      ).toString();
    }
  }

  public disconnect(providerName?: string) {
    if (providerName) {
      this.providers.find(({ name }) => name === providerName).disconnect();
    } else {
      this.providers.forEach((prov) => prov.disconnect());
    }
  }

  public static printStats() {
    if (MoonwallContext) {
      console.dir(MoonwallContext.getContext(), { depth: 1 });
    } else {
      console.log("Global context not created!");
    }
  }

  public static getContext(config?: MoonwallConfig): MoonwallContext {
    if (!MoonwallContext.instance) {
      if (!config) {
        console.error(
          "❌ Config must be provided on Global Context instantiation"
        );
        process.exit(1);
      }
      MoonwallContext.instance = new MoonwallContext(config);

      debugSetup(`🟢  Moonwall context "${config.label}" created`);
    }
    return MoonwallContext.instance;
  }

  public static destroy() {
    try {
      MoonwallContext.getContext().disconnect();
    } catch {
      console.log("🛑  All connections disconnected");
    }
    delete MoonwallContext.instance;
  }
}

export const contextCreator = async (config: MoonwallConfig, env: string) => {
  const ctx = MoonwallContext.getContext(config);
  await ctx.startNetwork(env);
  await ctx.connectEnvironment(env);
  return ctx;
};

export const runNetworkOnly = async (config: MoonwallConfig, env: string) => {
  const ctx = MoonwallContext.getContext(config);
  await ctx.startNetwork(env);
};
