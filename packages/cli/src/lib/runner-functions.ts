import "@moonbeam-network/api-augment";
import { describe, it, beforeAll, afterAll, File, assert } from "vitest";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Signer } from "ethers";
import { Web3 } from "web3";
import { ApiTypes, AugmentedEvent, SubmittableExtrinsic } from "@polkadot/api/types/index.js";
import { upgradeRuntime, upgradeRuntimeChopsticks } from "./upgrade.js";
import {
  ChopsticksContext,
  GenericContext,
  ITestSuiteType,
  UpgradePreferences,
  ZombieContext,
} from "../types/runner.js";
import { MoonwallContext, contextCreator } from "./globalContext.js";
import { BlockCreation, ChopsticksBlockCreation } from "./contextHelpers.js";
import { createDevBlock, devForkToFinalizedHead } from "../internal/foundations/devModeHelpers.js";
import {
  chopForkToFinalizedHead,
  createChopsticksBlock,
  sendNewBlockAndCheck,
  sendNewBlockRequest,
  sendSetStorageRequest,
} from "../internal/foundations/chopsticksHelpers.js";
import { ProviderType, ZombieNodeType } from "../types/config.js";
import { importJsonConfig } from "./configReader.js";
import Debug, { Debugger } from "debug";
import chalk from "chalk";

const RT_VERSION = Number(process.env.MOON_RTVERSION);
const RT_NAME = process.env.MOON_RTNAME;

// This should be refactored to use the vitest runner API for better integration
// https://vitest.dev/advanced/runner.html
export function describeSuite({
  id,
  title,
  testCases,
  foundationMethods,
  minRtVersion,
  chainType,
  notChainType,
}: ITestSuiteType) {
  let ctx: MoonwallContext;

  if (
    (minRtVersion && minRtVersion > RT_VERSION) ||
    (chainType && chainType !== RT_NAME) ||
    (notChainType && notChainType === RT_NAME)
  ) {
    describe.skip(`🗃️  #${id} ${title}`);
    return;
  }

  beforeAll(async function () {
    const globalConfig = await importJsonConfig();
    ctx = await contextCreator(globalConfig, process.env.MOON_TEST_ENV);
    if (ctx.environment.foundationType === "dev") {
      //   // await devForkToFinalizedHead(ctx); // TODO: Implement way of cleanly forking to fresh state
    } else if (ctx.environment.foundationType === "chopsticks") {
      // await chopForkToFinalizedHead(ctx); // TODO: Implement way of cleanly forking to fresh state
    }
  });

  afterAll(async function () {
    await MoonwallContext.destroy();
  });

  describe(`🗃️  #${id} ${title}`, function () {
    const context: GenericContext = {
      providers: {},

      polkadotJs: (options?: { apiName?: string; type?: ProviderType }): ApiPromise => {
        if (options && options.apiName) {
          return ctx.providers.find((a) => a.name == options.apiName)!.api as ApiPromise;
        } else if (options && options.type) {
          return ctx.providers.find((a) => a.type == options.type)!.api as ApiPromise;
        } else {
          return ctx.providers.find((a) => a.type == "moon" || a.type == "polkadotJs")!
            .api as ApiPromise;
        }
      },
      ethersSigner: (apiName?: string): Signer => {
        if (apiName) {
          return ctx.providers.find((a) => a.name == apiName)!.api as Signer;
        } else {
          return ctx.providers.find((a) => a.type == "ethers")!.api as Signer;
        }
      },
      web3: (apiName?: string): Web3 => {
        if (apiName) {
          return ctx.providers.find((a) => a.name == apiName)!.api as Web3;
        } else {
          return ctx.providers.find((a) => a.type == "web3")!.api as Web3;
        }
      },
    };

    const logger = () => {
      process.env.DEBUG_COLORS = "1";
      const debug = Debug(`test:${process.env.MOON_TEST_ENV}`);
      Debug.enable("test:*");
      Debug.log = console.info.bind(console);
      return debug;
    };

    const testCase = (params: {
      id: string;
      title: string;
      test: () => void;
      modifier?: TestCaseModifier;
      minRtVersion?: number;
      chainType?: "moonbeam" | "moonriver" | "moonbase";
      notChainType?: "moonbeam" | "moonriver" | "moonbase";
      // networkName?: string; TODO: Implement this
      timeout?: number;
    }) => {
      if (params.modifier) {
        it[params.modifier](
          `📁  #${id.concat(params.id)} ${params.title}`,
          params.test,
          params.timeout
        );
        return;
      }
      if (
        (params.minRtVersion && params.minRtVersion > RT_VERSION) ||
        (params.chainType && params.chainType !== RT_NAME) ||
        (params.notChainType && params.notChainType === RT_NAME)
      ) {
        it.skip(`📁  #${id.concat(params.id)} ${params.title}`, params.test, params.timeout);
        return;
      }

      it(`📁  #${id.concat(params.id)} ${params.title}`, params.test, params.timeout);
    };

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
        },
        it: testCase,
        log: logger(),
      });
    } else if (foundationMethods == "chopsticks") {
      testCases({
        context: {
          ...context,
          createBlock: async (options: ChopsticksBlockCreation = {}) =>
            await createChopsticksBlock(context, options),
          setStorage: async (params?: {
            providerName?: string;
            module: string;
            method: string;
            methodParams: any[];
          }) => await sendSetStorageRequest(params),
          upgradeRuntime: async (chCtx: ChopsticksContext) => {
            await upgradeRuntimeChopsticks(chCtx, ctx.rtUpgradePath!);
          },
        },
        it: testCase,
        log: logger(),
      });
    } else if (foundationMethods == "zombie") {
      testCases({
        context: {
          ...context,
          waitBlock: async (blocksToWaitFor: number = 1, chain: string = "parachain") => {
            const ctx = MoonwallContext.getContext();
            const api = ctx.providers.find((prov) => prov.name === chain).api as ApiPromise;
            const currentBlockNumber = (
              await api.rpc.chain.getBlock()
            ).block.header.number.toNumber();

            while (true) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const newBlockNumber = (
                await api.rpc.chain.getBlock()
              ).block.header.number.toNumber();
              if (newBlockNumber >= currentBlockNumber + blocksToWaitFor) {
                break;
              }
            }
          },
          upgradeRuntime: async (options?: UpgradePreferences) => {
            const ctx = MoonwallContext.getContext();
            const api = ctx.providers.find((prov) => prov.name === "parachain").api as ApiPromise;

            const params: UpgradePreferences = {
              runtimeName: options.runtimeName || "moonbase",
              runtimeTag: options.runtimeTag || "local",
              localPath: options.localPath || ctx.rtUpgradePath!,
              useGovernance: options.useGovernance || false,
              waitMigration: options.waitMigration || true,
            };

            if (options.logger) {
              params.logger = options.logger;
            }

            await upgradeRuntime(api, params);
          },
        },
        it: testCase,
        log: logger(),
      });
    } else if (foundationMethods == "read_only") {
      testCases({
        context: {
          ...context,
          waitBlock: async (blocksToWaitFor: number = 1, chainName?: string) => {
            const ctx = MoonwallContext.getContext();
            const provider = chainName
              ? ctx.providers.find(
                  (prov) =>
                    prov.name === chainName && (prov.type === "moon" || prov.type === "polkadotJs")
                )
              : ctx.providers.find((prov) => prov.type === "moon" || prov.type === "polkadotJs");

            if (!!!provider) {
              throw new Error("No PolkadotJs api found in provider config");
            }

            const api = provider.api as ApiPromise;

            const currentBlockNumber = (
              await api.rpc.chain.getBlock()
            ).block.header.number.toNumber();

            while (true) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              const newBlockNumber = (
                await api.rpc.chain.getBlock()
              ).block.header.number.toNumber();
              if (newBlockNumber >= currentBlockNumber + blocksToWaitFor) {
                break;
              }
            }
          },
        },
        it: testCase,
        log: logger(),
      });
    } else {
      testCases({ context, it: testCase, log: logger() });
    }
  });
}

export { GenericContext };

// TODO: Extend to include skipIf() and runIf()
export type TestCaseModifier = "only" | "skip";
