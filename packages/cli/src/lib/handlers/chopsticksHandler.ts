import type {
  ChopsticksBlockCreation,
  ChopsticksContext,
  FoundationHandler,
} from "@moonwall/types";
import {
  ALITH_PRIVATE_KEY,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_PRIVATE_KEY,
  DOROTHY_PRIVATE_KEY,
  jumpRoundsChopsticks,
} from "@moonwall/util";
import { Keyring } from "@polkadot/api";
import type { ApiPromise } from "@polkadot/api";
import {
  createChopsticksBlock,
  getWsUrlFromConfig,
  sendSetStorageRequest,
} from "../../internal/foundations/chopsticksHelpers";
import { MoonwallContext } from "../globalContext.js";
import { upgradeRuntimeChopsticks } from "../upgradeProcedures.js";

export const chopsticksHandler: FoundationHandler<"chopsticks"> = ({
  testCases,
  context,
  testCase,
  logger,
}) => {
  const accountTypeLookup = () => {
    const metadata = ctx.polkadotJs().runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === "System"
    );
    const systemAccountStorageType = metadata.pallets[systemPalletIndex].storage
      .unwrap()
      .items.find((storage) => storage.name.toString() === "Account")?.type;

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

  const ctx = {
    ...context,
    get isEthereumChain() {
      return accountTypeLookup() === "AccountId20";
    },
    get isSubstrateChain() {
      return accountTypeLookup() === "AccountId32";
    },
    get pjsApi() {
      return context.polkadotJs();
    },

    get keyring() {
      return newKeyring();
    },

    createBlock: async (options: ChopsticksBlockCreation = {}) =>
      await createChopsticksBlock(context, options),
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
      const port = Number.parseInt(url.port);
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
