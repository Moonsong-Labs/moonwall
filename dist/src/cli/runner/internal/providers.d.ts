import Web3 from "web3";
import { Log } from "web3-core";
import { JsonRpcResponse } from "web3-core-helpers";
import { Subscription as Web3Subscription } from "web3-core-subscriptions";
import { BlockHeader } from "web3-eth";
export declare function customWeb3Request(web3: Web3, method: string, params: any[]): Promise<JsonRpcResponse>;
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
export declare function web3EthCall(web3: Web3, options: Web3EthCallOptions): Promise<JsonRpcResponse>;
export interface Subscription<T> extends Web3Subscription<T> {
    once: (type: "data" | "connected", handler: (data: T) => void) => Subscription<T>;
}
export declare function web3Subscribe(web3: Web3, type: "newBlockHeaders"): Subscription<BlockHeader>;
export declare function web3Subscribe(web3: Web3, type: "pendingTransactions"): Subscription<string>;
export declare function web3Subscribe(web3: Web3, type: "logs", params: {}): Subscription<Log>;
export declare type EnhancedWeb3 = Web3 & {
    customRequest: (method: string, params: any[]) => Promise<JsonRpcResponse>;
};
