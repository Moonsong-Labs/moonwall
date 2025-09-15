import type {
  MoonwallProvider,
  ProviderConfig,
  ProviderMap,
  ProviderType,
  ViemClient,
} from "@moonwall/types";
import { ApiPromise } from "@polkadot/api";
import { Wallet } from "ethers";
import { Web3 } from "web3";
import { type PolkadotClient } from "polkadot-api";
export declare class ProviderFactory {
  private providerConfig;
  private url;
  private privateKey;
  constructor(providerConfig: ProviderConfig);
  create(): MoonwallProvider;
  private createPolkadotJs;
  private createWeb3;
  private createEthers;
  private createViem;
  private createPapi;
  private createDefault;
  static prepare(providerConfigs: ProviderConfig[]): MoonwallProvider[];
  static prepareDefaultDev(): MoonwallProvider[];
  static prepareDefaultZombie(): MoonwallProvider[];
  static prepareNoEthDefaultZombie(): MoonwallProvider[];
}
interface GenericProvider<T extends ProviderType> {
  name: string;
  api: ProviderMap[T];
  type: T;
  greet: () =>
    | Promise<void>
    | Promise<{
        rtVersion: number;
        rtName: string;
      }>;
  disconnect: () => void | Promise<void>;
}
export declare class ProviderInterfaceFactory {
  name: string;
  type: ProviderType;
  connect: () => Promise<ApiPromise> | Wallet | Web3 | Promise<ViemClient> | PolkadotClient | null;
  constructor(
    name: string,
    type: ProviderType,
    connect: () => Promise<ApiPromise> | Wallet | Web3 | Promise<ViemClient> | PolkadotClient | null
  );
  create(): Promise<GenericProvider<this["type"]>>;
  private createPolkadotJs;
  private createWeb3;
  private createEthers;
  private createViem;
  private createPapi;
  static populate(
    name: string,
    type: ProviderType,
    connect: () => Promise<ApiPromise> | Wallet | Web3 | Promise<ViemClient> | PolkadotClient | null
  ): Promise<GenericProvider<ProviderType>>;
}
export declare const vitestAutoUrl: () => string;
export {};
