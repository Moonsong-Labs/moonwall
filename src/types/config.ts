import { Foundation, ProviderType } from "./enum.js";

export type MoonwallConfig = {
  label: string;
  defaultTestTimeout: number;
  environments: Environment[];
};

export type Environment = {
  name: string;
  testFileDir: string[];
  foundation: FoundationDetails;
  include?: string[];
  connections?: ProviderConfig[];
  threads?: number;
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
  options?: string[];
}

// TODO: Separate single chopsticks network and multi chopsticks into separate interfaces
export interface ChopsticksLaunchSpec extends GenericLaunchSpec {
  configPath: string;
  wsPort?: number;   // Quirk of Chopsticks is that port option  only for single mode not xcm
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
