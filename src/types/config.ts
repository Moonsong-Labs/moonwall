import { Foundation, ProviderType } from "./enum.js";

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
    ? {
        type: TFoundation;
        rtUpgradePath?: string;
        launchSpec: ChopsticksLaunchSpec[];
      }
    : { type: TFoundation };

export interface GenericLaunchSpec {
  name: string;
  alreadyRunning?: boolean;
  options?: string[];
}

// TODO: Separate single chopsticks network and multi chopsticks into separate interfaces
export interface ChopsticksLaunchSpec extends GenericLaunchSpec {
  configPath: string;

  // Quirk of Chopsticks is that port is only used for dev mode not xcm
  wsPort?: number;
  type?: "relaychain" | "parachain";

  // buildBlockMode only supported for single chopsticks
  // ws signal dev_newBlock to seal
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


