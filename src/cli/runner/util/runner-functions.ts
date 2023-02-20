import { describe, it, beforeAll, assert, TestAPI } from "vitest";
// import { MoonwallContext } from "../internal/globalContext";
import { getCurrentSuite, setFn } from "vitest/suite";
import { MoonwallContext } from "../../../../src/index.js";
import { blake2AsHex } from "@polkadot/util-crypto";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ConnectedProvider, Foundation, ProviderType } from "../lib/types";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
import {
  ApiTypes,
  AugmentedEvent,
  AugmentedEvents,
  SubmittableExtrinsic,
} from "@polkadot/api/types/index.js";
import {
  BlockCreation,
  BlockCreationResponse,
  ExtrinsicCreation,
  extractError,
} from "../../../utils/contextHelpers.js";
import { customWeb3Request } from "../internal/providers.js";
import Debug from "debug";
import { alith } from "../lib/accounts.js";
import { createAndFinalizeBlock } from "./block.js";
import { EventRecord } from "@polkadot/types/interfaces/types.js";
import { RegistryError } from "@polkadot/types-codec/types/registry";
import { setTimeout } from "timers/promises";
import globalConfig from "../../../../moonwall.config.js";
import {
  UpgradePreferences,
  upgradeRuntime,
  upgradeRuntimeChopsticks,
} from "./upgrade.js";
import { readFileSync } from "fs";
import {
  sendNewBlockRequest,
  sendSetStorageRequest,
} from "../internal/chopsticksHelpers.js";
import {
  createDevBlock,
  createDevBlockCheckEvents,
} from "../internal/devModeHelpers.js";
import { bool } from "@polkadot/types-codec";
const debug = Debug("test:setup");

export function describeSuite({
  id,
  title,
  testCases,
  foundationMethods,
}: TestSuiteType) {
  describe(`🗃️  #${id} ${title}`, function () {
    let ctx: MoonwallContext;

    beforeAll(() => {
      ctx = MoonwallContext.getContext();
    });

    const context: GenericContext = {
      providers: {},
      getPolkadotJs: (apiName?: string): ApiPromise => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == ProviderType.PolkadotJs
          ).api as ApiPromise;
        }
      },
      getMoonbeam: (apiName?: string): ApiPromise => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == ProviderType.Moonbeam
          ).api as ApiPromise;
        }
      },
      getEthers: (apiName?: string): WebSocketProvider => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == ProviderType.Ethers
          ).api as WebSocketProvider;
        }
      },
      getWeb3: (apiName?: string): Web3 => {
        if (apiName) {
          return context.providers[apiName];
        } else {
          return MoonwallContext.getContext().providers.find(
            (a) => a.type == ProviderType.Web3
          ).api as Web3;
        }
      },
    };

    if (ctx) {
      ctx.providers.forEach((a: ConnectedProvider) => {
        context.providers[a.name] = a.api;
      });
    }

    function testCase(params: {
      id: string;
      title: string;
      test: () => void;
      modifier?: "only" | "skip";
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

      it(
        `📁  #${id.concat(params.id)} ${params.title}`,
        params.test,
        params.timeout
      );
    }

    if (foundationMethods == Foundation.Dev) {
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
    } else if (foundationMethods == Foundation.Chopsticks) {
      testCases({
        context: {
          ...context,
          createBlock: async (params?: {
            providerName?: string;
            count?: number;
            to?: number;
          }) => await sendNewBlockRequest(params),
          setStorage: async (params?: {
            providerName?: string;
            module: string;
            method: string;
            methodParams: any[];
          }) => await sendSetStorageRequest(params),
          upgradeRuntime: async (ctx: ChopsticksContext) => {
            await upgradeRuntimeChopsticks(
              ctx,
              MoonwallContext.getContext().rtUpgradePath
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

interface CustomTest {
  (params: {
    id: string;
    title: string;
    test: () => void;
    modifier?: "only" | "skip";
    timeout?: number;
  }): void;
}

type TestSuiteType<TFoundation = Foundation> =
  TFoundation extends Foundation.Dev
    ? {
        id: string;
        title: string;
        testCases: (TestContext: DevTestContext) => void;
        options?: Object;
        foundationMethods?: TFoundation;
      }
    : TFoundation extends Foundation.Chopsticks
    ? {
        id: string;
        title: string;
        testCases: (TestContext: ChopsticksTestContext) => void;
        options?: Object;
        foundationMethods?: TFoundation;
      }
    : {
        id: string;
        title: string;
        testCases: (TestContext: GenericTestContext) => void;
        options?: Object;
        foundationMethods?: TFoundation;
      };

interface DevTestContext {
  context: DevModeContext;
  it: CustomTest;
}

interface ChopsticksTestContext {
  context: ChopsticksContext;
  it: CustomTest;
}

interface GenericTestContext {
  context: GenericContext;
  it: CustomTest;
}

export interface GenericContext {
  providers: Object;
  getPolkadotJs: ([name]?: string) => ApiPromise;
  getMoonbeam: ([name]?: string) => ApiPromise;
  getEthers: ([name]?: string) => WebSocketProvider;
  getWeb3: ([name]?: string) => Web3;
}

export interface ChopsticksContext extends GenericContext {
  createBlock: (params?: {
    providerName?: string;
    count?: number;
    to?: number;
  }) => Promise<void>;
  setStorage: (params: {
    providerName?: string;
    module: string;
    method: string;
    methodParams: any;
  }) => Promise<void>;
  upgradeRuntime: (context: ChopsticksContext) => Promise<void>;
}

export interface DevModeContext extends GenericContext {
  createBlock<
    ApiType extends ApiTypes,
    Call extends
      | SubmittableExtrinsic<ApiType>
      | Promise<SubmittableExtrinsic<ApiType>>
      | string
      | Promise<string>,
    Calls extends Call | Call[]
  >(
    transactions?: Calls,
    options?: BlockCreation
  ): Promise<
    BlockCreationResponse<
      ApiType,
      Calls extends Call[] ? Awaited<Call>[] : Awaited<Call>
    >
  >;
  createBlockAndCheck<
    ApiType extends ApiTypes,
    Call extends
      | SubmittableExtrinsic<ApiType>
      | Promise<SubmittableExtrinsic<ApiType>>
      | string
      | Promise<string>,
    Calls extends Call | Call[]
  >(
    events: AugmentedEvent<ApiType>[],
    transactions?: Calls,
    options?: BlockCreation
  ): Promise<{ match: boolean; events: any[] }>;
}

