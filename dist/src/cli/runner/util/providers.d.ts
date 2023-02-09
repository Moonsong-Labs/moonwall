import { ApiPromise } from '@polkadot/api';
import { ProviderConfig } from '../lib/types';
export declare function prepareProductionProviders(providerConfigs: ProviderConfig[]): {
    name: string;
    connect: () => Promise<ApiPromise>;
}[];
export declare function populateProviderInterface(name: string, connect: () => Promise<ApiPromise>): Promise<{
    name: string;
    api: ApiPromise;
    greet: () => void;
    disconnect: () => Promise<void>;
}>;
