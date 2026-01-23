import type {
  ChopsticksBlockCreation,
  ChopsticksContext,
  FoundationHandler,
} from "../../api/types/index.js";
import {
  ALITH_PRIVATE_KEY,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_PRIVATE_KEY,
  DOROTHY_PRIVATE_KEY,
  jumpRoundsChopsticks,
} from "../../util/index.js";
import { Keyring } from "@polkadot/api";
import type { ApiPromise } from "@polkadot/api";
import { createChopsticksBlock, getWsUrlFromConfig, sendSetStorageRequest } from "./helpers.js";
import { getEnvironmentFromConfig } from "../../services/config/index.js";
import { MoonwallContext } from "../../cli/lib/globalContext.js";
import { upgradeRuntimeChopsticks } from "../../cli/lib/upgradeProcedures.js";

export const chopsticksHandler: FoundationHandler<"chopsticks"> = ({
  testCases,
  context,
  testCase,
  logger,
}) => {
  const accountTypeLookup = (): string => {
    const metadata = ctx.polkadotJs().runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet: { name: { toString(): string } }) => pallet.name.toString() === "System"
    );
    const systemAccountStorageType = metadata.pallets[systemPalletIndex].storage
      .unwrap()
      .items.find(
        (storage: { name: { toString(): string } }) => storage.name.toString() === "Account"
      )?.type;

    if (!systemAccountStorageType) {
      throw new Error("System.Account storage not found");
    }

    return metadata.lookup.getTypeDef(systemAccountStorageType.asMap.key).type;
  };

  const newKeyring = () => {
    const isEth = accountTypeLookup() === "AccountId20";
    const keyring = new Keyring({
      type: isEth ? "ethereum" : "sr25519",
    });
    return {
      alice: keyring.addFromUri(isEth ? ALITH_PRIVATE_KEY : "//Alice", {
        name: "Alice default",
      }),
      bob: keyring.addFromUri(isEth ? BALTATHAR_PRIVATE_KEY : "//Bob", {
        name: "Bob default",
      }),
      charlie: keyring.addFromUri(isEth ? CHARLETH_PRIVATE_KEY : "//Charlie", {
        name: "Charlie default",
      }),
      dave: keyring.addFromUri(isEth ? DOROTHY_PRIVATE_KEY : "//Dave", {
        name: "Dave default",
      }),
    };
  };

  const ctx: ChopsticksContext = {
    ...context,
    get isEthereumChain(): boolean {
      return accountTypeLookup() === "AccountId20";
    },
    get isSubstrateChain(): boolean {
      return accountTypeLookup() === "AccountId32";
    },
    get pjsApi() {
      return context.polkadotJs();
    },

    get keyring() {
      return newKeyring();
    },

    createBlock: async (options: ChopsticksBlockCreation = {}) => {
      // Get newBlockTimeout from foundation config if not provided in options
      const env = getEnvironmentFromConfig();
      const launchSpec =
        env.foundation.type === "chopsticks" ? env.foundation.launchSpec[0] : undefined;
      const configTimeout = launchSpec?.newBlockTimeout;

      return await createChopsticksBlock(context, {
        ...options,
        timeout: options.timeout ?? configTimeout,
      });
    },
    setStorage: async (params: {
      providerName?: string;
      module: string;
      method: string;
      methodParams: any[];
    }) => await sendSetStorageRequest(params),

    upgradeRuntime: async (providerName?: string) => {
      const path = (await MoonwallContext.getContext()).rtUpgradePath;

      if (!path) {
        throw new Error("No runtime upgrade path defined in config");
      }
      await upgradeRuntimeChopsticks(ctx, path, providerName);
    },

    jumpRounds: async (options: { rounds: number; providerName?: string }) => {
      const api = context.polkadotJs(options.providerName);
      if (!containsPallet(api, "ParachainStaking")) {
        throw new Error("ParachainStaking pallet is not enabled");
      }

      const wsUrl = await getWsUrlFromConfig(options.providerName);
      const url = new URL(wsUrl);
      const port = Number.parseInt(url.port, 10);
      await jumpRoundsChopsticks(api, port, options.rounds);
    },
  } satisfies ChopsticksContext;

  testCases({
    context: ctx,
    it: testCase,
    log: logger.info.bind(logger),
    logger,
  });
};

const containsPallet = (polkadotJsApi: ApiPromise, palletName: string): boolean => {
  const metadata = polkadotJsApi.runtimeMetadata.asLatest;
  const systemPalletIndex = metadata.pallets.findIndex(
    (pallet) => pallet.name.toString() === palletName
  );

  return systemPalletIndex !== -1;
};
