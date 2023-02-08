import '@moonbeam-network/api-augment';
import { ApiPromise, WsProvider } from '@polkadot/api';
import {
  ConnectedProvider,
  LaunchedNode,
  MoonwallConfig,
  MoonwallEnvironment,
  MoonwallProvider,
  ProviderConfig,
} from '../types';

export function prepareProductionProviders(providerConfigs: ProviderConfig[]) {
  return providerConfigs.map(({ name, endpoints, type }) => {
    if (type === 'polkadotJs') {
      const url = endpoints.includes('ENV_VAR') ? process.env.WSS_URL : endpoints[0];
      const connect = async () => {
        const api = await ApiPromise.create({
          provider: new WsProvider(url),
          noInitWarn: true,
        });
        await api.isReady;
        return api;
      };
      return { name, connect };
    }
  });
}

export async function populateProviderInterface(name: string, connect: () => Promise<ApiPromise>) {
  const api = await connect();
  return {
    name,
    api,
    greet: () =>
      console.log(
        `👋  Provider ${name} is connected to chain` +
          ` ${api.consts.system.version.specName.toString()} ` +
          `RT${api.consts.system.version.specVersion.toNumber()}`
      ),
    disconnect: () => api.disconnect(),
  };
}
