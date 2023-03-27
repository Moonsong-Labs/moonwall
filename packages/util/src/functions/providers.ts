import "@moonbeam-network/api-augment";
import Web3, { JsonRpcResponse, Log } from "web3";
import { alith } from "../constants/accounts.js";
import { MIN_GAS_PRICE } from "../constants/chain.js";

export async function customWeb3Request(
  web3: Web3,
  method: string,
  params: any[]
) {
  return new Promise<JsonRpcResponse>((resolve, reject) => {
    (web3.currentProvider as any).send(
      {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      },
      (error: Error | null, result?: JsonRpcResponse) => {
        if (error) {
          reject(
            `Failed to send custom request (${method} (${params
              .map((p) => {
                const str = p.toString();
                return str.length > 128
                  ? `${str.slice(0, 96)}...${str.slice(-28)}`
                  : str;
              })
              .join(",")})): ${error.message || error.toString()}`
          );
        }
        resolve(result!);
      }
    );
  });
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
  return await customWeb3Request(web3, "eth_call", [
    {
      from: options.from == undefined ? options.from : alith.address,
      value: options.value,
      gas: options.gas == undefined ? options.gas : 256000,
      gasPrice: options.gas == undefined ? options.gas : `0x${MIN_GAS_PRICE}`,
      to: options.to,
      data: options.data,
    },
  ]);
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
  customRequest: (method: string, params: any[]) => Promise<JsonRpcResponse>;
};
