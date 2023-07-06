import {
  BlockCreation,
  CallType,
  DeepPartial,
  DevModeContext,
  EthersTransactionOptions,
  FoundationHandler,
  ViemTransactionOptions,
  ContractCallOptions,
} from "@moonwall/types";
import {
  ALITH_PRIVATE_KEY,
  alith,
  createEthersTransaction,
  createViemTransaction,
  deployViemContract,
} from "@moonwall/util";
import { ApiTypes } from "@polkadot/api/types/index.js";
import { createDevBlock } from "../../internal/foundations/devModeHelpers.js";
import { importJsonConfig } from "../configReader.js";
import {
  deployCreateCompiledContract,
  interactWithContract,
  interactWithPrecompileContract,
} from "../contractFunctions.js";
import { PrecompileCallOptions } from "@moonwall/types";
import { ContractDeploymentOptions } from "@moonwall/types";

export const devHandler: FoundationHandler<"dev"> = ({ testCases, context, testCase, logger }) => {
  const config = importJsonConfig();
  const env = config.environments.find((env) => env.name == process.env.MOON_TEST_ENV)!;
  const ethCompatible =
    env.foundation.type == "dev" && env.foundation.launchSpec[0].disableDefaultEthProviders;

  const ctx: DevModeContext = {
    ...context,
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
  };

  testCases({
    context: {
      ...ctx,
      createTxn: ethCompatible
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

      readPrecompile: ethCompatible
        ? undefined
        : async (options: PrecompileCallOptions) => {
            const response = await interactWithPrecompileContract(ctx, {
              call: true,
              ...options,
            });
            return response;
          },
      writePrecompile: ethCompatible
        ? undefined
        : async (options: PrecompileCallOptions) => {
            const response = await interactWithPrecompileContract(ctx, { call: false, ...options });
            return response as `0x${string}`;
          },

      readContract: ethCompatible
        ? undefined
        : async (options: ContractCallOptions) => {
            const response = await interactWithContract(ctx, {
              call: true,
              ...options,
            });
            return response;
          },

      writeContract: ethCompatible
        ? undefined
        : async (options: ContractCallOptions) => {
            const response = await interactWithContract(ctx, { call: false, ...options });
            return response as `0x${string}`;
          },

      deployContract: ethCompatible
        ? undefined
        : async (contractName: string, options?: ContractDeploymentOptions) => {
            return await deployCreateCompiledContract(ctx, contractName, options);
          },
    },

    it: testCase,
    log: logger(),
  });
};

// deployContract?(options: ContractDeploymentOptions): Promise<{
//   contractAddress: `0x${string}` | null;
//   status: "success" | "reverted";
//   logs: Log<bigint, number>[];
//   hash: `0x${string}`;
// }>;
