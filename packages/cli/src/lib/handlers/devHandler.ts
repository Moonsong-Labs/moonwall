import { BlockCreation, CallType, FoundationHandler } from "@moonwall/types";
import { ApiTypes } from "@polkadot/api/types/index.js";
import { importJsonConfig } from "../configReader.js";
import { createDevBlock } from "../../internal/foundations/devModeHelpers.js";
import { ALITH_PRIVATE_KEY } from "@moonwall/util";

export const devHandler: FoundationHandler<"dev"> = ({ testCases, context, testCase, logger }) => {
    testCases({
      context: {
        ...context,
        createBlock: async <
          ApiType extends ApiTypes,
          Calls extends CallType<ApiType> | CallType<ApiType>[]
        >(
          transactions?: Calls,
          options: BlockCreation = {}
        ) => {
          const config = await importJsonConfig();
          const env = config.environments.find((env) => env.name == process.env.MOON_TEST_ENV)!;
  
          const defaults: BlockCreation = {
            signer: env.defaultSigner || { type: "ethereum", privateKey: ALITH_PRIVATE_KEY },
            allowFailures: env.defaultAllowFailures === undefined ? true : env.defaultAllowFailures,
            finalize: env.defaultFinalization === undefined ? true : env.defaultFinalization,
          };
          return await createDevBlock(context, transactions, { ...defaults, ...options });
        },
      },
      it: testCase,
      log: logger(),
    });
  };