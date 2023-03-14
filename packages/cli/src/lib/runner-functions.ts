import { describe, it, beforeAll, afterAll, File } from "vitest";
import { ApiPromise } from "@polkadot/api";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
import { ApiTypes, AugmentedEvent, SubmittableExtrinsic } from "@polkadot/api/types/index.js";
import Debug from "debug";
import { upgradeRuntimeChopsticks } from "./upgrade.js";
import { ChopsticksContext, GenericContext, ITestSuiteType } from "../types/runner.js";
import { MoonwallContext, contextCreator } from "./globalContext.js";
import { BlockCreation } from "./contextHelpers.js";
import { createDevBlock, createDevBlockCheckEvents, devForkToFinalizedHead } from "../internal/devModeHelpers.js";
import {
  chopForkToFinalizedHead,
  sendNewBlockAndCheck,
  sendNewBlockRequest,
  sendSetStorageRequest,
} from "../internal/chopsticksHelpers.js";
import { ProviderType } from "../types/config.js";
import { importJsonConfig } from "./configReader.js";

const debug = Debug("test:setup");

// This should be refactored to use the vitest runner API for better integration
// https://vitest.dev/advanced/runner.html
export function describeSuite({ id, title, testCases, foundationMethods }: ITestSuiteType) {
  let ctx: MoonwallContext;

  beforeAll(async function () {
    const globalConfig = await importJsonConfig();
    ctx = await contextCreator(globalConfig, process.env.TEST_ENV);
    // if (ctx.environment.foundationType === "dev") {
    //   // await devForkToFinalizedHead(ctx); // TODO: Implement way of cleanly forking to fresh state
    // } else if (ctx.environment.foundationType === "chopsticks") {
    //   await chopForkToFinalizedHead(ctx);
    // }
  });

  afterAll(async function () {
    await MoonwallContext.destroy();
  });

  describe(`🗃️  #${id} ${title}`, function () {
    const context: GenericContext = {
      providers: {},

      getSubstrateApi: (options?: { apiName?: string; type?: ProviderType }): ApiPromise => {
        if (options && options.apiName) {
          return context.providers[options.apiName];
        } else if (options && options.type) {
          return ctx.providers.find((a) => a.type == options.type)!.api as ApiPromise;
        } else {
          return ctx.providers.find((a) => a.type == "moon" || a.type == "polkadotJs")!.api as ApiPromise;
        }
      },
      getPolkadotJs: (apiName?: string): ApiPromise => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return ctx.providers.find((a) => a.type == "polkadotJs")!.api as ApiPromise;
        }
      },
      getMoonbeam: (apiName?: string): ApiPromise => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return ctx.providers.find((a) => a.type == "moon")!.api as ApiPromise;
        }
      },
      getEthers: (apiName?: string): WebSocketProvider => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return ctx.providers.find((a) => a.type == "ethers")!.api as WebSocketProvider;
        }
      },
      getWeb3: (apiName?: string): Web3 => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return ctx.providers.find((a) => a.type == "web3")!.api as Web3;
        }
      },
    };

    function testCase(params: {
      id: string;
      title: string;
      test: () => void;
      modifier?: TestCaseModifier;
      skipIf?: boolean;
      timeout?: number;
    }) {
      if (params.modifier) {
        it[params.modifier](`📁  #${id.concat(params.id)} ${params.title}`, params.test, params.timeout);
        return;
      }

      if (params.skipIf) {
        it.skip(`📁  #${id.concat(params.id)} ${params.title}`, params.test, params.timeout);
        return;
      }

      it(`📁  #${id.concat(params.id)} ${params.title}`, params.test, params.timeout);
    }

    if (foundationMethods == "dev") {
      testCases({
        context: {
          ...context,
          createBlock: async <
            ApiType extends ApiTypes,
            Call extends
              | SubmittableExtrinsic<ApiType>
              | Promise<SubmittableExtrinsic<ApiType>>
              | string
              | Promise<string>,
            Calls extends Call | Call[]
          >(
            transactions?: Calls,
            options: BlockCreation = {}
          ) => await createDevBlock(context, transactions, options),
          createBlockAndCheck: async <
            ApiType extends ApiTypes,
            Call extends
              | SubmittableExtrinsic<ApiType>
              | Promise<SubmittableExtrinsic<ApiType>>
              | string
              | Promise<string>,
            Calls extends Call | Call[]
          >(
            expectedEvents: AugmentedEvent<ApiType>[],
            transactions?: Calls,
            options: BlockCreation = {}
          ) => await createDevBlockCheckEvents(context, expectedEvents, transactions, options),
        },
        it: testCase,
        beforeAll,
      });
    } else if (foundationMethods == "chopsticks") {
      testCases({
        context: {
          ...context,
          createBlock: async (params?: { providerName?: string; count?: number; to?: number }) =>
            await sendNewBlockRequest(params),
          createBlockAndCheck: async (expectedEvents: AugmentedEvent<ApiTypes>[]) =>
            await sendNewBlockAndCheck(context, expectedEvents),
          setStorage: async (params?: { providerName?: string; module: string; method: string; methodParams: any[] }) =>
            await sendSetStorageRequest(params),
          upgradeRuntime: async (chCtx: ChopsticksContext) => {
            await upgradeRuntimeChopsticks(chCtx, ctx.rtUpgradePath!);
          },
        },
        it: testCase,
        beforeAll,
      });
    } else {
      testCases({ context, it: testCase, beforeAll });
    }
  });
}
export { GenericContext };

// TODO: Extend to include skipIf() and runIf()
export type TestCaseModifier = "only" | "skip";
