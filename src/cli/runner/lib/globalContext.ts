import '@moonbeam-network/api-augment';
import { ApiPromise, WsProvider } from '@polkadot/api';
import {
  ConnectedProvider,
  LaunchedNode,
  MoonwallConfig,
  MoonwallEnvironment,
  MoonwallProvider,
} from './types';
import { populateProviderInterface, prepareProductionProviders } from './util/providers';
import Mocha, { MochaOptions } from 'mocha';
const debug = require('debug')('global:setup');


let globalContext: MoonwallContext

export class MoonwallContext {
  // private static instance: MoonwallContext;
  environments: MoonwallEnvironment[];
  providers: ConnectedProvider[];
  // mocha: Mocha;
  nodes?: LaunchedNode[];

  constructor(config: MoonwallConfig) {
    this.environments = [];
    this.providers = [];
    // this.mocha = new Mocha({ timeout: config.defaultTestTimeout, globals: []});

    config.environments.forEach((env) => {
      const blob = { name: env.name, context: {}, providers: [] };

      switch (env.foundation.type) {
        case 'production':
          blob.providers.push(...prepareProductionProviders(env.connections));
          debug(`🟢  Foundation "${env.foundation.type}" setup`);
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
  public static printStats() {
    if (globalContext) {
      console.log(globalContext);
    } else {
      console.log('Global context not created!');
    }
  }

  public static getContext(config?: MoonwallConfig): MoonwallContext {
    if (!globalContext) {
      if (!config) {
        console.error('❌ Config must be provided on Global Context instantiation');
        process.exit(1);
      }
      globalContext = new MoonwallContext(config);
    }
    return globalContext;
  }
}
