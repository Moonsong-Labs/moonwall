export type MoonwallConfig = {
  $schema: string;
  label: string;
  defaultTestTimeout: number;
  environments: Environment[];
};

export type Environment = {
  reporters?: string[];
  name: string;
  testFileDir: string[];
  envVars?: string[];
  foundation: IFoundation;
  include?: string[];
  connections?: ProviderConfig[];
  multiThreads?: boolean;
  defaultEthTxnStyle?: EthTransactionType;
};

export type IFoundation =
  | {
      type: "dev";
      launchSpec: DevLaunchSpec[];
    }
  | {
      type: "chopsticks";
      rtUpgradePath?: string;
      launchSpec: ChopsticksLaunchSpec[];
    }
  | {
      type: "zombie";
      rtUpgradePath?: string;
      zombieSpec: ZombieLaunchSpec;
    }
  | {
      type: "read_only" | "fork";
    };

export type EthTransactionType = "Legacy" | "EIP2930" | "EIP1559";

export type FoundationType = IFoundation["type"];

export interface GenericLaunchSpec {
  name: string;
  running?: boolean;
  options?: string[];
}

export interface ZombieLaunchSpec extends GenericLaunchSpec {
  configPath: string;
  monitoredNode?: string;
  skipBlockCheck?: string[];
}

// TODO: Separate single chopsticks network and multi chopsticks into separate interfaces
export interface ChopsticksLaunchSpec extends GenericLaunchSpec {
  configPath: string;
  wsPort?: number; // Quirk of Chopsticks is that port option  only for single mode not xcm
  type?: "relaychain" | "parachain";
  wasmOverride?: string;
  // buildBlockMode only supported for single mode chopsticks
  buildBlockMode?: "batch" | "manual" | "instant";
}

export interface DevLaunchSpec extends GenericLaunchSpec {
  binPath: string;
  disableDefaultEthProviders?: boolean;
  ports?: {
    p2pPort: number;
    wsPort: number;
    rpcPort: number;
  };
}

export interface ProviderConfig {
  name: string;
  type: ProviderType;
  endpoints: string[];
  rpc?: IRpcBundle;
}

// TODO: Make Provider Sub-types (for viem and polkadot.js)
export type ProviderType =
  | "polkadotJs"
  | "ethers"
  | "web3"
  | "moon"
  | "unknown"
  | "viemPublic"
  | "viemWallet";

export type ViemClientType = "public" | "wallet";

export type ZombieNodeType = "relaychain" | "parachain";

export interface IRpcParam {
  name: string;
  type: string;
  isOptional?: boolean;
}

export interface IRpcMethod {
  description: string;
  params: IRpcParam[];
  type: string;
}

export interface IRpcModule {
  [methodName: string]: IRpcMethod;
}

export interface IRpcBundle {
  [moduleName: string]: IRpcModule;
}
