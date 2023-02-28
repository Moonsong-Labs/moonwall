import { Foundation, MoonwallConfig } from "../../types/config";
import { ChildProcess } from "child_process";
import {
  populateProviderInterface,
  prepareProviders,
} from "../../utils/providers.js";
import { launchDevNode } from "./localNode.js";
import {  importConfigDefault } from "../../utils/configReader.js";
import { parseChopsticksRunCmd, parseRunCmd } from "./foundations.js";
import { ApiPromise } from "@polkadot/api";
import Debug from "debug";
import {
  ConnectedProvider,
  MoonwallEnvironment,
  MoonwallProvider,
} from "../../types/context.js";
const debugSetup = Debug("global:context");

export class MoonwallContext {
  private static instance: MoonwallContext;
  environment: MoonwallEnvironment;
  providers: ConnectedProvider[];
  nodes: ChildProcess[];
  foundation?: Foundation;
  private _finalizedHead?: string;
  rtUpgradePath?: string;

  constructor(config: MoonwallConfig) {
    this.environment;
    this.providers = [];
    this.nodes = [];

    const env = config.environments.find(
      ({ name }) => name == process.env.TEST_ENV
    )!;
    const blob = {
      name: env.name,
      context: {},
      providers: [] as MoonwallProvider[],
      nodes: [] as { name?: string; cmd: string; args: string[] }[],
      foundationType: env.foundation.type,
    };

    switch (env.foundation.type) {
      case "read_only":
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

      case "chopsticks":
        blob.nodes.push(parseChopsticksRunCmd(env.foundation.launchSpec));
        blob.providers.push(...prepareProviders(env.connections!));
        this.rtUpgradePath = env.foundation.rtUpgradePath;
        debugSetup(
          `🟢  Foundation "${env.foundation.type}" parsed for environment: ${env.name}`
        );
        break;

      case "dev":
        const { cmd, args } = parseRunCmd(env.foundation.launchSpec[0]);
        blob.nodes.push({
          name: env.foundation.launchSpec[0].name,
          cmd,
          args,
        });

        blob.providers = env.connections
          ? prepareProviders(env.connections)
          : prepareProviders([
              {
                name: "w3",
                type: "web3",
                endpoints: [
                  `ws://127.0.0.1:${
                    10000 + Number(process.env.VITEST_POOL_ID || 1) * 100
                  }`,
                ],
              },
              {
                name: "eth",
                type: "ethers",
                endpoints: [
                  `ws://127.0.0.1:${
                    10000 + Number(process.env.VITEST_POOL_ID || 1) * 100
                  }`,
                ],
              },
              {
                name: "mb",
                type: "moon",
                endpoints: [
                  `ws://127.0.0.1:${
                    10000 + Number(process.env.VITEST_POOL_ID || 1) * 100
                  }`,
                ],
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
    if (this.nodes.length > 0) {
      console.log("Nodes already started! Skipping command");
      return MoonwallContext.getContext();
    }

    const nodes = MoonwallContext.getContext().environment.nodes;

    const promises = nodes.map(async ({ cmd, args, name }) => {
      return this.nodes.push(await launchDevNode(cmd, args, name!));
    });
    await Promise.all(promises);
  }

  public async stopNetwork() {
    if (this.nodes.length === 0) {
      console.log("Nodes already stopped! Skipping command");
      return MoonwallContext.getContext();
    }

    this.nodes.forEach((node) => node.kill());
  }

  public async connectEnvironment(environmentName: string) {
    if (this.providers.length > 0) {
      console.log("Providers already connected! Skipping command");
      return MoonwallContext.getContext();
    }

    const globalConfig = await importConfigDefault();
    const promises = this.environment.providers.map(
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
    )!.foundation.type;

    // TODO: Do we actually need this?
    if (this.foundation == "dev") {
      this.genesis = (
        await (
          this.providers.find(
            ({ type }) =>
              type == "polkadotJs" || type =="moon"
          )!.api as ApiPromise
        ).rpc.chain.getBlockHash(0)
      ).toString();
    }

    if (this.foundation == "chopsticks") {
      this.genesis = (
        await (
          this.providers.find(
            ({ type }) =>
              type == "polkadotJs" || type == "moon"
          )!.api as ApiPromise
        ).rpc.chain.getFinalizedHead()
      ).toString();
    }
  }

  public async disconnect(providerName?: string) {
    if (providerName) {
      this.providers.find(({ name }) => name === providerName)!.disconnect();
    } else {
      await Promise.all(this.providers.map((prov) => prov.disconnect()));
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
    MoonwallContext.getContext().nodes.forEach((process) => process.kill());
  }
}

export const contextCreator = async (config: MoonwallConfig, env: string) => {
  const ctx = MoonwallContext.getContext(config);
  await runNetworkOnly(config);
  await ctx.connectEnvironment(env);
  return ctx;
};

export const runNetworkOnly = async (config: MoonwallConfig) => {
  const ctx = MoonwallContext.getContext(config);
  await ctx.startNetwork();
};
