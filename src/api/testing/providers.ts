import type { Web3 } from "web3";
import { alith } from "../constants/accounts.js";
import { MIN_GAS_PRICE } from "../constants/chain.js";

export async function customWeb3Request(web3: Web3, method: string, params: any[]) {
  return new Promise((resolve, reject) => {
    ((web3.eth as any).currentProvider as any).send(
      {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      },
      (error: Error | null, result?: any) => {
        if (error) {
          reject(
            `Failed to send custom request (${method} (${params
              .map((p) => {
                const str = p.toString();
                return str.length > 128 ? `${str.slice(0, 96)}...${str.slice(-28)}` : str;
              })
              .join(",")})): ${error.message || error.toString()}`
          );
        }
        resolve(result);
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
      from: options.from === undefined ? options.from : alith.address,
      value: options.value,
      gas: options.gas === undefined ? options.gas : 256000,
      gasPrice: options.gas === undefined ? options.gas : `0x${MIN_GAS_PRICE}`,
      to: options.to,
      data: options.data,
    },
  ]);
}

export type EnhancedWeb3 = Web3 & {
  customRequest: (method: string, params: any[]) => Promise<any>;
};
