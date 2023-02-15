import { ApiPromise } from "@polkadot/api";
import Web3 from "web3";
import { ethers } from "ethers";
import { MoonwallProvider, ProviderConfig, ProviderType } from "../lib/types";
import { WebSocketProvider } from "ethers";
export declare function prepareProviders(providerConfigs: ProviderConfig[]): MoonwallProvider[];
export declare function populateProviderInterface(name: string, type: ProviderType, connect: () => Promise<ApiPromise> | Promise<WebSocketProvider> | Web3 | void, ws?: () => void): Promise<{
    name: string;
    api: ApiPromise;
    type: ProviderType;
    greet: () => any;
    disconnect: () => Promise<void>;
} | {
    name: string;
    api: ethers.WebSocketProvider;
    type: ProviderType;
    greet: () => Promise<any>;
    disconnect: () => void;
} | {
    name: string;
    api: Web3;
    type: ProviderType;
    greet: () => Promise<void>;
    disconnect: () => void;
}>;
