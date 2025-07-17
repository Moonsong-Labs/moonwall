import "@moonbeam-network/api-augment";
import type { Web3 } from "web3";
import { alith } from "../constants/accounts";
import { MIN_GAS_PRICE } from "../constants/chain";
import { runPromiseEffect } from "../effect/interop";
import { customWeb3RequestEffect, web3EthCallEffect } from "../effect/providers.effect";

export async function customWeb3Request(web3: Web3, method: string, params: any[]) {
  // Use Effect-based implementation internally
  return runPromiseEffect(customWeb3RequestEffect(web3, method, params));
}

export interface Web3EthCallOptions {
  from?: string | number;
  to: string;
  value?: number | string | bigint;
  gas?: number | string;
  gasPrice?: number | string | bigint;
  maxPriorityFeePerGas?: number | string | bigint;
  maxFeePerGas?: number | string | bigint;
  data?: string;
  nonce?: number;
}

export async function web3EthCall(web3: Web3, options: Web3EthCallOptions) {
  // Use Effect-based implementation internally
  return runPromiseEffect(web3EthCallEffect(web3, options));
}

// Extra type because web3 is not well typed
// export interface Subscription<T> extends Web3Subscription<T> {
//   once: (
//     type: "data" | "connected",
//     handler: (data: T) => void
//   ) => Subscription<T>;
// }

// Little helper to hack web3 that are not complete.
// export function web3Subscribe(
//   web3: Web3,
//   type: "newBlockHeaders"
// ): Subscription<BlockHeader>;
// export function web3Subscribe(
//   web3: Web3,
//   type: "pendingTransactions"
// ): Subscription<string>;
// export function web3Subscribe(
//   web3: Web3,
//   type: "logs",
//   params: {}
// ): Subscription<Log>;
// export function web3Subscribe(
//   web3: Web3,
//   type: "newBlockHeaders" | "pendingTransactions" | "logs",
//   params?: any
// ) {
//   return (web3.eth as any).subscribe(...[].slice.call(arguments, 1));
// }

export type EnhancedWeb3 = Web3 & {
  customRequest: (method: string, params: any[]) => Promise<any>;
};
