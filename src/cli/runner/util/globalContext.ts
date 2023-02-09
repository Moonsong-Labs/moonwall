import { setTimeout } from 'timers/promises';
import {
  ConnectedProvider,
  LaunchedNode,
  MoonwallConfig,
  MoonwallEnvironment,
  MoonwallProvider,
} from '../lib/types';
import { populateProviderInterface, prepareProductionProviders } from './providers';
const debug = require('debug')('global:context');

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
console.log(blob)
      switch (env.foundation.type) {
        case 'production':
          blob.providers = prepareProductionProviders(env.connections);
          debug(`🟢  Foundation "${env.foundation.type}" setup`);
          console.log(blob.providers)
          break;
        default:
          debug(`🚧  Foundation "${env.foundation.type}" unsupported, skipping setup`);
          return;
      }
      this.environments.push(blob);
    });
  }

  public env(query: string): MoonwallEnvironment | undefined {
    return this.environments.find(({ name }) => name == query);
  }

  public async connect(environmentName: string) {
    const promises = this.environments
      .find(({ name }) => name === environmentName)
      .providers.map(
        async ({ name, connect }) =>
          new Promise(async (resolve) => {
            const providerDetails = await populateProviderInterface(name, connect);
            this.providers.push(providerDetails);
            resolve('');
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

  public static  printStats() {
    if (MoonwallContext) {
      console.log(MoonwallContext.instance);
    } else {
      console.log('Global context not created!');
    }
  }
  
   public static  getContext(config?: MoonwallConfig): MoonwallContext {
    if (!MoonwallContext.instance) {
      if (!config) {
        console.error('❌ Config must be provided on Global Context instantiation');
        process.exit(1);
      }
      MoonwallContext.instance = new MoonwallContext(config);
    }
    return MoonwallContext.instance;
  }
  public static async destroy(){
    MoonwallContext.instance.disconnect()
    delete MoonwallContext.instance
    await setTimeout(2000)
  }
}