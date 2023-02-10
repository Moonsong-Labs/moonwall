import {
  ConnectedProvider,
  LaunchedNode,
  MoonwallConfig,
  MoonwallEnvironment,
} from "../lib/types";
import {
  populateProviderInterface,
  prepareProductionProviders,
} from "./providers";
const debug = require("debug")("global:context");

export class MoonwallContext {
  private static instance: MoonwallContext;
  environments: MoonwallEnvironment[];
  providers: ConnectedProvider[];
  nodes?: LaunchedNode[];

  constructor(config: MoonwallConfig) {
    this.environments = [];
    this.providers = [];

    config.environments.forEach((env) => {
      const blob = { name: env.name, context: {}, providers: [] };

      switch (env.foundation.type) {
        case "production":
          blob.providers = prepareProductionProviders(env.connections);
          debug(`🟢  Foundation "${env.foundation.type}" setup`);
          break;
        default:
          debug(
            `🚧  Foundation "${env.foundation.type}" unsupported, skipping setup`
          );
          return;
      }
      this.environments.push(blob);
    });
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
      console.log(MoonwallContext.getContext());
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
      debug(`🟢  Moonwall context "${config.label}" created`);
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
  console.log(env);
  const ctx = MoonwallContext.getContext(config);
  debug(`🟢  Global context fetched for mocha`);
  await ctx.connectEnvironment(env);
  ctx.providers.forEach(async ({ greet }) => await greet());
};
