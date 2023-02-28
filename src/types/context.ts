import { ApiPromise, WsProvider } from "@polkadot/api";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
import { Foundation, ProviderType } from "./config.js";
// import { Foundation, ProviderType } from "./enum.js";

export type MoonwallEnvironment = {
  name: string;
  providers: MoonwallProvider[];
  foundationType: Foundation;
  nodes: Node[];
  context: any;
};

export interface MoonwallProvider {
  name: string;
  type: ProviderType;
  connect: () => Promise<ApiPromise> | Promise<WebSocketProvider> | Web3 | void;
  ws?: () => WsProvider;
}

export interface ConnectedProvider {
  name: string;
  type: ProviderType;
  api: ApiPromise | WebSocketProvider | Web3;
  disconnect: () => Promise<void>;
  greet: () => Promise<void> | void;
}

export type Node = {
  name?: string;
  // type: "binary" | "chopsticks" | "zombie";
  cmd: string;
  args: string[];
  rtUpgradePath?: string;
};
