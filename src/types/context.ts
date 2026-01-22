import "@polkadot/api-base/types/events";
import type { ApiPromise, WsProvider } from "@polkadot/api";
import type { ApiTypes, AugmentedEvent, SubmittableExtrinsic } from "@polkadot/api-base/types";
import type { KeyringPair } from "@polkadot/keyring/types";
import type { GenericExtrinsic } from "@polkadot/types";
import type { EventRecord } from "@polkadot/types/interfaces";
import type { AnyTuple, RegistryError } from "@polkadot/types/types";
import type { Logger } from "pino";
import type { Wallet } from "ethers";
import type { Web3 } from "web3";
import type { FoundationType, ProviderType } from "./config.js";
import type { CallType } from "./foundations.js";
import type { ViemClient } from "./runner.js";
import type { PolkadotClient } from "polkadot-api";

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
    | Wallet
    | Web3<any>
    | Promise<ViemClient>
    | PolkadotClient
    | null;
  ws?: (timeout?: number) => WsProvider;
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
  api: ProviderApi;
  disconnect: () => Promise<void> | void;
  greet: () => Promise<void> | Promise<{ rtName: string; rtVersion: number }>;
}

export type ProviderApi = {
  [P in keyof ProviderMap]: ProviderMap[P];
}[keyof ProviderMap];

export type ProviderMap = {
  polkadotJs: ApiPromise;
  ethers: Wallet;
  web3: Web3;
  moon: ApiPromise;
  viem: ViemClient;
  papi: PolkadotClient;
};

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

export interface ChopsticksBlockCreation {
  providerName?: string;
  count?: number;
  to?: number;
  expectEvents?: AugmentedEvent<ApiTypes>[];
  allowFailures?: boolean;
  logger?: Logger;
  /** Optional timeout in milliseconds for the new block RPC request */
  timeout?: number;
}

export interface BlockCreation {
  parentHash?: string;
  finalize?: boolean;
  allowFailures?: boolean;
  expectEvents?: AugmentedEvent<ApiTypes>[];
  logger?: Logger;
  signer?: { type: "ethereum" | "sr25519" | "ed25519"; privateKey: string } | KeyringPair;
}

export interface BlockCreationResponse<
  ApiType extends ApiTypes,
  Calls extends CallType<ApiType> | CallType<ApiType>[],
> {
  block: {
    duration: number;
    hash: string;
    proofSize?: number;
  };
  result?: Calls extends (string | SubmittableExtrinsic<ApiType>)[]
    ? ExtrinsicCreation[]
    : ExtrinsicCreation;
}

export interface ExtrinsicCreation {
  extrinsic: GenericExtrinsic<AnyTuple> | null;
  events: EventRecord[];
  error: RegistryError | undefined;
  successful: boolean;
  hash: string;
}
