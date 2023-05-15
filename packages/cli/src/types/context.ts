import { ApiPromise, WsProvider } from "@polkadot/api";
import { Signer } from "ethers";
import { Web3 } from "web3";
import { FoundationType, ProviderType } from "./config.js";
import { PublicViem, WalletViem } from "./runner.js";

/**
 * @name MoonwallEnvironment
 * @description The Moonwall environment object.
 * @property name - The name of the environment.
 * @property providers - An array of MoonwallProvider objects.
 * @property foundationType - The type of foundation in use.
 * @property nodes - An array of Node objects.
 */
export type MoonwallEnvironment = {
  name: string;
  providers: MoonwallProvider[];
  foundationType: FoundationType;
  nodes: Node[];
};

/**
 * @name MoonwallProvider
 * @description The Moonwall provider object.
 * @property name - The name of the provider.
 * @property type - The type of the provider.
 * @property connect - A function that returns a Promise resolving to a connected API instance.
 * @property ws - An optional function returning a WebSocket provider.
 */
export interface MoonwallProvider {
  name: string;
  type: ProviderType;
  connect: () =>
    | Promise<ApiPromise>
    | Signer
    | Web3
    | Promise<PublicViem>
    | Promise<WalletViem>
    | void;
  ws?: () => WsProvider;
}

/**
 * @name ConnectedProvider
 * @description The connected provider object.
 * @property name - The name of the provider.
 * @property type - The type of the provider.
 * @property api - The connected API instance.
 * @property disconnect - A function that returns a Promise resolving when the provider is disconnected.
 * @property greet - A function that returns a greeting message or an object containing runtime information.
 */
export interface ConnectedProvider {
  name: string;
  type: ProviderType;
  api: ApiPromise | Signer | Web3 | PublicViem | WalletViem;
  disconnect: () => Promise<void>;
  greet: () => Promise<void> | void | { rtName: string; rtVersion: number };
}

/**
 * @name Node
 * @description The Node object.
 * @property name - The optional name of the node.
 * @property cmd - The command to start the node.
 * @property args - The arguments for the command.
 * @property rtUpgradePath - The optional runtime upgrade path.
 * @property launch - UNUSED
 */
export type Node = {
  name?: string;
  cmd: string;
  args: string[];
  rtUpgradePath?: string;
  launch?: boolean;
};
