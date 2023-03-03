import { describe, it, beforeAll } from "vitest";
import { setTimeout } from "timers/promises";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
import {
  ApiTypes,
  AugmentedEvent,
  SubmittableExtrinsic,
} from "@polkadot/api/types/index.js";

import Debug from "debug";
import { upgradeRuntimeChopsticks } from "./upgrade.js";
import {
  ChopsticksContext,
  GenericContext,
  ITestSuiteType,
} from "../types/runner.js";
import {
  MoonwallContext,
  contextCreator,
} from "../cli/internal/globalContext.js";

import { ConnectedProvider } from "../types/context.js";
import { BlockCreation } from "./contextHelpers.js";
import {
  createDevBlock,
  createDevBlockCheckEvents,
  devForkToFinalizedHead,
} from "../cli/internal/devModeHelpers.js";
import {
  chopForkToFinalizedHead,
  sendNewBlockAndCheck,
  sendNewBlockRequest,
  sendSetStorageRequest,
} from "../cli/internal/chopsticksHelpers.js";
import { importConfig } from "./configReader.js";
import { ProviderType } from "../types/config.js";

const debug = Debug("test:setup");

export function describeSuite({
  id,
  title,
  testCases,
  foundationMethods,
}: ITestSuiteType) {
  describe(`🗃️  #${id} ${title}`, function () {
    let ctx: MoonwallContext;

    beforeAll(async function () {
      await setTimeout(10000)
      ctx = MoonwallContext.getContext();
      if (ctx.environment.foundationType === "dev") {
        await devForkToFinalizedHead(ctx);
      } else if (ctx.environment.foundationType === "chopsticks") {
        await chopForkToFinalizedHead(ctx);
      }
    });

    const context: GenericContext = {
      providers: {},

      getSubstrateApi: (options?: {
        apiName?: string;
        type?: ProviderType;
      }): ApiPromise => {
        if (options && options.apiName) {
          return context.providers[options.apiName];
        } else if (options && options.type) {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == options.type
          )!.api as ApiPromise;
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == "moon" || a.type == "polkadotJs"
          )!.api as ApiPromise;
        }
      },
      getPolkadotJs: (apiName?: string): ApiPromise => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == "polkadotJs"
          )!.api as ApiPromise;
        }
      },
      getMoonbeam: (apiName?: string): ApiPromise => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == "moon"
          )!.api as ApiPromise;
        }
      },
      getEthers: (apiName?: string): WebSocketProvider => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == "ethers"
          )!.api as WebSocketProvider;
        }
      },
      getWeb3: (apiName?: string): Web3 => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == "web3"
          )!.api as Web3;
        }
      },
    };

    // if (ctx) {
    //   ctx.providers.forEach((a: ConnectedProvider) => {
    //     context.providers[a.name] = a.api;
    //   });
    // }

    function testCase(params: {
      id: string;
      title: string;
      test: () => void;
      modifier?: TestCaseModifier;
      skipIf?: boolean;
      timeout?: number;
    }) {
    
      if (params.modifier) {
        it[params.modifier](
          `📁  #${id.concat(params.id)} ${params.title}`,
          params.test,
          params.timeout
        );
        return;
      }

      if (params.skipIf) {
        it.skip(
          `📁  #${id.concat(params.id)} ${params.title}`,
          params.test,
          params.timeout
        );
        return 
      }

      it(
        `📁  #${id.concat(params.id)} ${params.title}`,
        params.test,
        params.timeout
      );
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
          ) =>
            await createDevBlockCheckEvents(
              context,
              expectedEvents,
              transactions,
              options
            ),
        },
        it: testCase,
      });
    } else if (foundationMethods == "chopsticks") {
      testCases({
        context: {
          ...context,
          createBlock: async (params?: {
            providerName?: string;
            count?: number;
            to?: number;
          }) => await sendNewBlockRequest(params),
          createBlockAndCheck: async (
            expectedEvents: AugmentedEvent<ApiTypes>[]
          ) => await sendNewBlockAndCheck(context, expectedEvents),
          setStorage: async (params?: {
            providerName?: string;
            module: string;
            method: string;
            methodParams: any[];
          }) => await sendSetStorageRequest(params),
          upgradeRuntime: async (ctx: ChopsticksContext) => {
            await upgradeRuntimeChopsticks(
              ctx,
              MoonwallContext.getContext().rtUpgradePath!
            );
          },
        },
        it: testCase,
      });
    } else {
      testCases({ context, it: testCase });
    }
  });
}
export { GenericContext };

// TODO: Extend to include skipIf() and runIf()
type TestCaseModifier = "only" | "skip";
