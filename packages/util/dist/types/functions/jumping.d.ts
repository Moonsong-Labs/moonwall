import "@moonbeam-network/api-augment";
import type { ApiPromise } from "@polkadot/api";
export declare function jumpBlocksDev(polkadotJsApi: ApiPromise, blocks: number): Promise<void>;
export declare function jumpRoundsDev(
  polkadotJsApi: ApiPromise,
  count: number
): Promise<string | null>;
export declare function jumpToRoundDev(
  polkadotJsApi: ApiPromise,
  round: number
): Promise<string | null>;
export declare function jumpRoundsChopsticks(
  polkadotJsApi: ApiPromise,
  port: number,
  count: number
): Promise<string>;
export declare function jumpToRoundChopsticks(
  polkadotJsApi: ApiPromise,
  port: number,
  round: number
): Promise<string>;
export declare function jumpBlocksChopsticks(port: number, blockCount: number): Promise<string>;
