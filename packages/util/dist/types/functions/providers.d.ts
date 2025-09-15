import "@moonbeam-network/api-augment";
import type { Web3 } from "web3";
export declare function customWeb3Request(
  web3: Web3,
  method: string,
  params: any[]
): Promise<unknown>;
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
export declare function web3EthCall(web3: Web3, options: Web3EthCallOptions): Promise<unknown>;
export type EnhancedWeb3 = Web3 & {
  customRequest: (method: string, params: any[]) => Promise<any>;
};
