export type MoonwallConfig = {
  label: string;
  defaultTestTimeout: number;
  environments: Environment[];
};

export type Environment = {
  html?: boolean;
  name: string;
  testFileDir: string[];
  foundation: IFoundation;
  include?: string[];
  connections?: ProviderConfig[];
  threads?: number;
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
      type: "read_only" | "fork" | "zombie";
    };

export type FoundationType = IFoundation["type"];

export interface GenericLaunchSpec {
  name: string;
  running?: boolean;
  options?: string[];
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
}

export type ProviderType =
  | "polkadotJs"
  | "ethers"
  | "web3"
  | "moon"
  | "unknown";
