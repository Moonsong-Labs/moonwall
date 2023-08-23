import {
  BlockCreation,
  CallType,
  ContractCallOptions,
  ContractDeploymentOptions,
  DeepPartial,
  DevModeContext,
  EthersTransactionOptions,
  FoundationHandler,
  PrecompileCallOptions,
  ViemTransactionOptions,
} from "@moonwall/types";
import {
  ALITH_PRIVATE_KEY,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_PRIVATE_KEY,
  DOROTHY_PRIVATE_KEY,
  alith,
  createEthersTransaction,
  createViemTransaction,
} from "@moonwall/util";
import { ApiTypes } from "@polkadot/api/types";
import { createDevBlock } from "../../internal/foundations/devModeHelpers";
import { importJsonConfig, isEthereumDevConfig } from "../configReader";
import {
  deployCreateCompiledContract,
  interactWithContract,
  interactWithPrecompileContract,
} from "../contractFunctions";
import { Keyring } from "@polkadot/api";

export const devHandler: FoundationHandler<"dev"> = ({ testCases, context, testCase, logger }) => {
  const config = importJsonConfig();
  const env = config.environments.find((env) => env.name == process.env.MOON_TEST_ENV)!;
  const ethCompatible = isEthereumDevConfig();

  const accountTypeLookup = () => {
    const metadata = ctx.polkadotJs().runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === "System"
    );
    const systemAccountStorageType = metadata.pallets[systemPalletIndex].storage
      .unwrap()
      .items.find((storage) => storage.name.toString() === "Account")!.type;

    return metadata.lookup.getTypeDef(systemAccountStorageType.asMap.key).type;
  };

  const newKeyring = () => {
    const isEth = accountTypeLookup() == "AccountId20";
    const keyring = new Keyring({
      type: isEth ? "ethereum" : "sr25519",
    });
    return {
      alice: keyring.addFromUri(isEth ? ALITH_PRIVATE_KEY : "//Alice", { name: "Alice default" }),
      bob: keyring.addFromUri(isEth ? BALTATHAR_PRIVATE_KEY : "//Bob", { name: "Bob default" }),
      charlie: keyring.addFromUri(isEth ? CHARLETH_PRIVATE_KEY : "//Charlie", {
        name: "Charlie default",
      }),
      dave: keyring.addFromUri(isEth ? DOROTHY_PRIVATE_KEY : "//Dave", { name: "Dave default" }),
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

    createBlock: async <
      ApiType extends ApiTypes,
      Calls extends CallType<ApiType> | CallType<ApiType>[]
    >(
      transactions?: Calls,
      options?: BlockCreation
    ) => {
      const defaults: BlockCreation = {
        signer: env.defaultSigner || alith,
        allowFailures: env.defaultAllowFailures === undefined ? true : env.defaultAllowFailures,
        finalize: env.defaultFinalization === undefined ? true : env.defaultFinalization,
      };
      return await createDevBlock(context, { ...defaults, ...options }, transactions);
    },

    createTxn: !ethCompatible
      ? undefined
      : <
          TOptions extends
            | (DeepPartial<ViemTransactionOptions> & {
                libraryType?: "viem";
              })
            | (EthersTransactionOptions & {
                libraryType: "ethers";
              })
        >(
          options: TOptions
        ) => {
          const { libraryType = "viem", ...txnOptions } = options;
          return libraryType === "viem"
            ? createViemTransaction(ctx, txnOptions as DeepPartial<ViemTransactionOptions>)
            : createEthersTransaction(ctx, txnOptions as EthersTransactionOptions);
        },

    readPrecompile: !ethCompatible
      ? undefined
      : async (options: PrecompileCallOptions) => {
          const response = await interactWithPrecompileContract(ctx, {
            call: true,
            ...options,
          });
          return response;
        },
    writePrecompile: !ethCompatible
      ? undefined
      : async (options: PrecompileCallOptions) => {
          const response = await interactWithPrecompileContract(ctx, { call: false, ...options });
          return response as `0x${string}`;
        },

    readContract: !ethCompatible
      ? undefined
      : async (options: ContractCallOptions) => {
          const response = await interactWithContract(ctx, {
            call: true,
            ...options,
          });
          return response;
        },

    writeContract: !ethCompatible
      ? undefined
      : async (options: ContractCallOptions) => {
          const response = await interactWithContract(ctx, { call: false, ...options });
          return response as `0x${string}`;
        },

    deployContract: !ethCompatible
      ? undefined
      : async (contractName: string, options?: ContractDeploymentOptions) => {
          return await deployCreateCompiledContract(ctx, contractName, options);
        },
  } satisfies DevModeContext;

  testCases({
    context: ctx,
    it: testCase,
    log: logger(),
  });
};
