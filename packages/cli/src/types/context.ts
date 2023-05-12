import { ApiPromise, WsProvider } from "@polkadot/api";
import { Signer } from "ethers";
import { Web3 } from "web3";
import { FoundationType, ProviderType } from "./config.js";
import { PublicViem, WalletViem } from "./runner.js";

export type MoonwallEnvironment = {
  name: string;
  providers: MoonwallProvider[];
  foundationType: FoundationType;
  nodes: Node[];
};

export interface MoonwallProvider {
  name: string;
  type: ProviderType;
  connect: () => Promise<ApiPromise> | Signer | Web3 | PublicViem | WalletViem | void;
  ws?: () => WsProvider;
}

export interface ConnectedProvider {
  name: string;
  type: ProviderType;
  api: ApiPromise | Signer | Web3 | PublicViem | WalletViem;
  disconnect: () => Promise<void>;
  greet: () => Promise<void> | void | { rtName: string; rtVersion: number };
}

export type Node = {
  name?: string;
  cmd: string;
  args: string[];
  rtUpgradePath?: string;
  launch?: boolean;
};
