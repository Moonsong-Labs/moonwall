import type { Web3 } from "web3";

/**
 * Type definitions for Web3 provider interactions
 */

export interface Web3Provider {
  send: (
    payload: {
      jsonrpc: "2.0";
      id: number;
      method: string;
      params: unknown[];
    },
    callback: (error: Error | null, result?: unknown) => void
  ) => void;
}

export interface Web3EthWithProvider {
  currentProvider: Web3Provider;
  subscribe: (
    type: string,
    params?: Record<string, unknown>
  ) => {
    on: (event: string, handler: (data: unknown) => void) => void;
    unsubscribe: () => void;
  };
}

export interface RpcError extends Error {
  code?: number;
  data?: unknown;
}

/**
 * Helper type for RPC response results
 */
export type RpcResult<T> = {
  jsonrpc: "2.0";
  id: number;
  result: T;
};

/**
 * Helper type for RPC error responses
 */
export type RpcErrorResponse = {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};
