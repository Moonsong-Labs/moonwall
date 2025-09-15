import "@moonbeam-network/api-augment";
import type { ApiPromise } from "@polkadot/api";
import { setupLogger as createTestLogger } from "./logger";
export declare const setupLogger: typeof createTestLogger;
export declare function log(...msg: any[]): void;
export declare const printTokens: (
  api: ApiPromise,
  tokens: bigint,
  decimals?: number,
  pad?: number
) => string;
export declare const printEvents: (api: ApiPromise, hash?: string) => Promise<void>;
