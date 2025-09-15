import "@moonbeam-network/api-augment";
import type { KeyringPair } from "@polkadot/keyring/types";
export declare const ALITH_ADDRESS: `0x${string}`;
export declare const ALITH_PRIVATE_KEY: `0x${string}`;
export declare const ALITH_SESSION_ADDRESS: `0x${string}`;
export declare const ALITH_CONTRACT_ADDRESSES: `0x${string}`[];
export declare const BALTATHAR_ADDRESS: `0x${string}`;
export declare const BALTATHAR_PRIVATE_KEY: `0x${string}`;
export declare const BALTATHAR_SESSION_ADDRESS: `0x${string}`;
export declare const CHARLETH_ADDRESS: `0x${string}`;
export declare const CHARLETH_PRIVATE_KEY: `0x${string}`;
export declare const CHARLETH_SESSION_ADDRESS: `0x${string}`;
export declare const DOROTHY_ADDRESS: `0x${string}`;
export declare const DOROTHY_PRIVATE_KEY: `0x${string}`;
export declare const ETHAN_ADDRESS: `0x${string}`;
export declare const ETHAN_PRIVATE_KEY: `0x${string}`;
export declare const FAITH_ADDRESS: `0x${string}`;
export declare const FAITH_PRIVATE_KEY: `0x${string}`;
export declare const GOLIATH_ADDRESS: `0x${string}`;
export declare const GOLIATH_PRIVATE_KEY: `0x${string}`;
export declare const GERALD_ADDRESS: `0x${string}`;
export declare const GERALD_PRIVATE_KEY: `0x${string}`;
export declare const GERALD_CONTRACT_ADDRESSES: `0x${string}`[];
export declare const ALITH_GENESIS_FREE_BALANCE: bigint;
export declare const ALITH_GENESIS_LOCK_BALANCE: bigint;
export declare const ALITH_GENESIS_RESERVE_BALANCE: bigint;
export declare const ALITH_GENESIS_TRANSFERABLE_BALANCE: bigint;
export declare const alith: KeyringPair;
export declare const baltathar: KeyringPair;
export declare const charleth: KeyringPair;
export declare const dorothy: KeyringPair;
export declare const ethan: KeyringPair;
export declare const faith: KeyringPair;
export declare const goliath: KeyringPair;
export declare const gerald: KeyringPair;
export declare function generateKeyringPair(
  type?: "ethereum" | "sr25519" | "ed25519",
  privateKey?: string
): KeyringPair;
