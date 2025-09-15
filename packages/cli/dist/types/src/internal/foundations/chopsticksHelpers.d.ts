import "@moonbeam-network/api-augment";
import type { ChopsticksBlockCreation, GenericContext } from "@moonwall/types";
import type { WsProvider } from "@polkadot/api";
import type { ApiTypes, AugmentedEvent } from "@polkadot/api/types";
import type { FrameSystemEventRecord } from "@polkadot/types/lookup";
export declare function getWsFromConfig(providerName?: string): Promise<WsProvider>;
export declare function getWsUrlFromConfig(providerName?: string): Promise<string>;
export declare function sendNewBlockAndCheck(
  context: GenericContext,
  expectedEvents: AugmentedEvent<ApiTypes>[]
): Promise<{
  match: boolean;
  events: FrameSystemEventRecord[];
}>;
export declare function createChopsticksBlock(
  context: GenericContext,
  options?: ChopsticksBlockCreation
): Promise<{
  result: string;
}>;
export declare function sendSetHeadRequest(newHead: string, providerName?: string): Promise<string>;
export declare function sendNewBlockRequest(params?: {
  providerName?: string;
  count?: number;
  to?: number;
}): Promise<string>;
export declare function sendSetStorageRequest(params: {
  providerName?: string;
  module: string;
  method: string;
  methodParams: any[];
}): Promise<void>;
