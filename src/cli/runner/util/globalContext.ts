import {
  ConnectedProvider,
  FoundationType,
  MoonwallConfig,
  MoonwallEnvironment,
  Node,
} from "../lib/types";
import { ChildProcess, spawn } from "child_process";
import {
  populateProviderInterface,
  prepareProductionProviders,
} from "./providers";
import { launchDevNode } from "./LocalNode";
const debugSetup = require("debug")("global:context");
const debugNode = require("debug")("global:node");

export class MoonwallContext {
  private static instance: MoonwallContext;
  environments: MoonwallEnvironment[];
  providers: ConnectedProvider[];
  nodes: ChildProcess[];

  constructor(config: MoonwallConfig) {
    this.environments = [];
    this.providers = [];
    this.nodes = [];

    config.environments.forEach((env) => {
      const blob = { name: env.name, context: {}, providers: [], nodes: [] };

      switch (env.foundation.type) {
        case FoundationType.ReadOnly:
          blob.providers = prepareProductionProviders(env.connections);
          debugSetup(
            `🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`
          );
          break;

        case FoundationType.DevMode:
          /// eventually turn this into function
          const item = env.foundation.launchSpec[0];
          const cmd = item.bin.path;
          let args = [...item.options];
          const ports = item.ports;
          if (ports.p2pPort) {
            args.push(`--port=${ports.p2pPort}`);
          }
          if (ports.wsPort) {
            args.push(`--ws-port=${ports.wsPort}`);
          }
          if (ports.rpcPort) {
            args.push(`--rpc-port=${ports.rpcPort}`);
          }

          // const args = env.foundation.launchSpec[0]

          debugNode(`The run command is: ${cmd}`);
          debugNode(`The run args are: ${args}`);

          blob.nodes.push({
            name: item.bin.name,
            cmd,
            args,
          });

          // function end
          blob.providers = prepareProductionProviders(env.connections);
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

  public async startNetwork(environmentName: string) {
    console.log(environmentName);

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
  debugSetup(`🟢  Global context fetched for mocha`);
  await ctx.startNetwork(env);
  await ctx.connectEnvironment(env);
  await Promise.all(ctx.providers.map(async ({ greet }) => greet()))
};
