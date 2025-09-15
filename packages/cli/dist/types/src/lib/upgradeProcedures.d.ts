import "@moonbeam-network/api-augment";
import type { ChopsticksContext, UpgradePreferences } from "@moonwall/types";
import type { ApiPromise } from "@polkadot/api";
export declare function upgradeRuntimeChopsticks(
  context: ChopsticksContext,
  path: string,
  providerName?: string
): Promise<void>;
export declare function upgradeRuntime(
  api: ApiPromise,
  preferences: UpgradePreferences
): Promise<number>;
