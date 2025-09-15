import {
  ALITH_PRIVATE_KEY,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_PRIVATE_KEY,
  DOROTHY_PRIVATE_KEY,
  alith,
  createEthersTransaction,
  createViemTransaction,
  jumpBlocksDev,
  jumpRoundsDev,
} from "@moonwall/util";
import { Keyring } from "@polkadot/api";
import { createDevBlock } from "../../internal/foundations/devModeHelpers";
import { getEnvironmentFromConfig, isEthereumDevConfig } from "../configReader";
import {
  deployCreateCompiledContract,
  interactWithContract,
  interactWithPrecompileContract,
} from "../contractFunctions";
export const devHandler = ({ testCases, context, testCase, logger }) => {
  const env = getEnvironmentFromConfig();
  const ethCompatible = isEthereumDevConfig();
  const accountTypeLookup = () => {
    const metadata = ctx.polkadotJs().runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === "System"
    );
    const systemAccountStorage = metadata.pallets[systemPalletIndex].storage
      .unwrap()
      .items.find((storage) => storage.name.toString() === "Account");
    if (!systemAccountStorage) {
      throw new Error("Account storage not found");
    }
    const systemAccountStorageType = systemAccountStorage.type;
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
  const containsPallet = (palletName) => {
    const metadata = context.polkadotJs().runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === palletName
    );
    return systemPalletIndex !== -1;
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
    get isParachainStaking() {
      return containsPallet("ParachainStaking");
    },
    get keyring() {
      return newKeyring();
    },
    createBlock: async (transactions, options) => {
      const defaults = {
        signer: env.defaultSigner || alith,
        allowFailures: env.defaultAllowFailures === undefined ? true : env.defaultAllowFailures,
        finalize: env.defaultFinalization === undefined ? true : env.defaultFinalization,
      };
      return await createDevBlock(context, { ...defaults, ...options }, transactions);
    },
    createTxn: !ethCompatible
      ? undefined
      : (options) => {
          const { libraryType = "viem", ...txnOptions } = options;
          return libraryType === "viem"
            ? createViemTransaction(ctx, txnOptions)
            : createEthersTransaction(ctx, txnOptions);
        },
    readPrecompile: !ethCompatible
      ? undefined
      : async (options) => {
          const response = await interactWithPrecompileContract(ctx, {
            call: true,
            ...options,
          });
          return response;
        },
    writePrecompile: !ethCompatible
      ? undefined
      : async (options) => {
          const response = await interactWithPrecompileContract(ctx, {
            call: false,
            ...options,
          });
          return response;
        },
    readContract: !ethCompatible
      ? undefined
      : async (options) => {
          const response = await interactWithContract(ctx, {
            call: true,
            ...options,
          });
          return response;
        },
    writeContract: !ethCompatible
      ? undefined
      : async (options) => {
          const response = await interactWithContract(ctx, {
            call: false,
            ...options,
          });
          return response;
        },
    deployContract: !ethCompatible
      ? undefined
      : async (contractName, options) => {
          return await deployCreateCompiledContract(ctx, contractName, options);
        },
    jumpBlocks: async (blocks) => {
      await jumpBlocksDev(context.polkadotJs(), blocks);
    },
    jumpRounds: async (rounds) => {
      if (!ctx.isParachainStaking) {
        throw new Error("ParachainStaking pallet is not enabled");
      }
      await jumpRoundsDev(context.polkadotJs(), rounds);
    },
  };
  testCases({
    context: ctx,
    it: testCase,
    log: logger.info.bind(logger),
    logger,
  });
};
//# sourceMappingURL=devHandler.js.map
