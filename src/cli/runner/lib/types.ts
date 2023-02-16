import { ApiPromise } from "@polkadot/api";
import { WebSocketProvider } from "ethers";
import { Interface } from "readline";
import Web3 from "web3";

export type MoonwallConfig = {
  label: string;
  defaultTestTimeout: number;
  environments: Environment[];
};

export type Environment = {
  name: string;
  testFileDir: string;
  foundation: FoundationDetails;
  include?: string[];
  connections?: ProviderConfig[];
};

export type FoundationDetails<TFoundation = Foundation> =
  TFoundation extends Foundation.Dev
    ? {
        type: TFoundation;
        launchSpec: DevLaunchSpec[];
      }
    : TFoundation extends Foundation.Chopsticks
    ? { type: TFoundation; launchSpec: ChopsticksLaunchSpec[] }
    : { type: TFoundation };

export interface GenericLaunchSpec {
  name: string;
  alreadyRunning?: boolean;
  options?: string[];
}

export interface ChopsticksLaunchSpec extends GenericLaunchSpec {
  configPath: string;
}

export interface DevLaunchSpec extends GenericLaunchSpec {
  binPath: string;
  ports?: {
    p2pPort: number;
    wsPort: number;
    rpcPort: number;
  };
}

export enum Foundation {
  ReadOnly = "read_only",
  Dev = "dev",
  Forked = "fork",
  ZombieNet = "zombie",
  Chopsticks = "chopsticks",
}

export interface ProviderConfig {
  name: string;
  type: ProviderType;
  endpoints: string[];
}

export type MoonwallEnvironment = {
  name: string;
  providers: MoonwallProvider[];
  nodes: Node[];
  context: any;
};

export interface MoonwallProvider {
  name: string;
  type: ProviderType;
  connect: () => Promise<ApiPromise> | Promise<WebSocketProvider> | Web3 | void;
  ws?: any;
}

export interface ConnectedProvider {
  name: string;
  type: ProviderType;
  api: ApiPromise | WebSocketProvider | Web3;
  disconnect: () => void;
  greet: () => Promise<void> | void;
}

export enum ProviderType {
  PolkadotJs = <any>"polkadotJs",
  Ethers = <any>"ethers",
  Web3 = <any>"web3",
  Moonbeam = <any>"moon",
  Unknown = <any>"unknown",
}

export type Node = {
  name: string;
  type: "binary" | "chopsticks" | "zombie";
  cmd: string;
  args: string[];
};
