import "@moonbeam-network/api-augment";
import {
  BlockCreation,
  ChopsticksBlockCreation,
  ChopsticksContext,
  ConnectedProvider,
  GenericContext,
  ITestSuiteType,
  ProviderApi,
  ProviderType,
  PublicViem,
  UpgradePreferences,
  ViemApiMap,
  ViemClientType,
  WalletViem,
  ProviderMap,
} from "@moonwall/types";
import { ApiPromise } from "@polkadot/api";
import { ApiTypes } from "@polkadot/api/types/index.js";
import { error } from "console";
import Debug from "debug";
import { Signer } from "ethers";
import { afterAll, beforeAll, describe, it } from "vitest";
import { Web3 } from "web3";
import {
  createChopsticksBlock,
  sendSetStorageRequest,
} from "../internal/foundations/chopsticksHelpers.js";
import { CallType, createDevBlock } from "../internal/foundations/devModeHelpers.js";
import { importJsonConfig } from "./configReader.js";
import { MoonwallContext, contextCreator } from "./globalContext.js";
import { upgradeRuntime, upgradeRuntimeChopsticks } from "./upgrade.js";
import { ALITH_PRIVATE_KEY } from "@moonwall/util";

const RT_VERSION = Number(process.env.MOON_RTVERSION);
const RT_NAME = process.env.MOON_RTNAME;

// This should be refactored to use the vitest runner API for better integration
// https://vitest.dev/advanced/runner.html

/**
 *  * Defines a suite of tests based on provided parameters.
 *
 * @param {object} params - The setup parameters for the test suite.
 * @param {string} params.id - A unique identifier for the test suite (e.g. D03).
 * @param {string} params.title - The title of the test suite (e.g. 'Fee calculation: congestion handling').
 * @param {function} params.testCases - A callback function that houses the individual test cases of this suite.
 * @param {string} params.foundationMethods - Explicitly specify which foundation these tests will run against reveal which methods to make available.
 * @param {number} [params.minRtVersion] - The minimum runtime version required for the test suite, otherwise will be skipped.
 * @param {string} [params.chainType] - The required runtime name required for the test suite, otherwise will be skipped.
 * @param {string} [params.notChainType] - The runtime name to not run against this test suite, otherwise will not be skipped.
 *
 * @returns {void} - No explicit return value, this function results is wrapped and handled by the vitest instance.
 * @example
 *      describeSuite({
 *        id: "D01",
 *        title: "Sample test suite",
 *        foundationMethods: "dev",
 *        testCases: ({ it, context, log }) => {
 *          it({
 *            id: "T01",
 *            title: "Sample test case",
 *            test: async function () {
 *              expect(true).to.be.true;
 *            },
 *          });
 *        },
 *      });
 */
export function describeSuite({
  id,
  title,
  testCases,
  foundationMethods,
  minRtVersion,
  chainType,
  notChainType,
}: ITestSuiteType): void {
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

    if (!process.env.MOON_TEST_ENV) {
      throw new error("MOON_TEST_ENV not set");
    }

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

  const tim = getApi("viemPublic");
  function getApi(type: "polkadotJs", apiName?: string): ApiPromise;
  function getApi(type: "ethers", apiName?: string): Signer;
  function getApi(type: "web3", apiName?: string): Web3;
  function getApi(type: "viemPublic", apiName?: string): PublicViem;
  function getApi(type: "viemWallet", apiName?: string): WalletViem;
  function getApi<T extends ProviderType>(type: T, apiName?: string) {
    if (type == "polkadotJs") {
      return apiName
        ? ctx.providers.find(
            (a) => (a.type == "moon" || a.type == "polkadotJs") && a.name === apiName
          )!.api
        : ctx.providers.find((a) => a.type == "moon" || a.type == "polkadotJs")!.api;
    } else {
      return apiName
        ? ctx.providers.find((a) => a.type == type && a.name === apiName)!.api
        : ctx.providers.find((a) => a.type == type)!.api;
    }
  }

  describe(`🗃️  #${id} ${title}`, function () {
    const context: GenericContext = {
      api: (type: ProviderType, name?: string) => getApi(type, name),
      viemClient: <T extends ViemClientType>(subType: T): ViemApiMap[T] => {
        let provider: ConnectedProvider | undefined;
        if (subType === "public") {
          provider = ctx.providers.find((prov) => prov.type == "viemPublic");
        } else {
          provider = ctx.providers.find((prov) => prov.type == "viemWallet");
        }

        if (!provider) {
          throw new Error(`Provider of type '${subType}' not found`);
        }

        return provider.api as ViemApiMap[T];
      },
      polkadotJs: (options?: { apiName?: string; type?: ProviderType }): ApiPromise =>
        options && options.apiName
          ? (ctx.providers.find((a) => a.name == options.apiName)!.api as ApiPromise)
          : options && options.type
          ? (ctx.providers.find((a) => a.type == options.type)!.api as ApiPromise)
          : (ctx.providers.find((a) => a.type == "moon" || a.type == "polkadotJs")!
              .api as ApiPromise),
      ethersSigner: (apiName?: string): Signer =>
        apiName
          ? (ctx.providers.find((a) => a.name == apiName)!.api as Signer)
          : (ctx.providers.find((a) => a.type == "ethers")!.api as Signer),
      web3: (apiName?: string): Web3 =>
        apiName
          ? (ctx.providers.find((a) => a.name == apiName)!.api as Web3)
          : (ctx.providers.find((a) => a.type == "web3")!.api as Web3),
    };

    const logger = () => {
      process.env.DEBUG_COLORS = "1";

      const debug = Debug(`test:${process.env.MOON_TEST_ENV}`);
      debug.log = console.log.bind(process.stdout);
      Debug.enable("test:*");

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
            Calls extends CallType<ApiType> | CallType<ApiType>[]
          >(
            transactions?: Calls,
            options: BlockCreation = {}
          ) => {
            const config = await importJsonConfig();
            const env = config.environments.find((env) => env.name == process.env.MOON_TEST_ENV)!;

            const defaults: BlockCreation = {
              signer: env.defaultSigner || { type: "ethereum", privateKey: ALITH_PRIVATE_KEY },
              allowFailures:
                env.defaultAllowFailures === undefined ? true : env.defaultAllowFailures,
              finalize: env.defaultFinalization === undefined ? true : env.defaultFinalization,
            };
            return await createDevBlock(context, transactions, { ...defaults, ...options });
          },
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
          waitBlock: async (
            blocksToWaitFor: number = 1,
            chain: string = "parachain",
            mode: "height" | "quantity" = "quantity"
          ) => {
            const ctx = MoonwallContext.getContext();
            const provider = ctx.providers.find((prov) => prov.name === chain);

            if (!!!provider) {
              throw new Error(`Provider '${chain}' not found`);
            }

            const api = provider.api as ApiPromise;
            const currentBlockNumber = (
              await api.rpc.chain.getBlock()
            ).block.header.number.toNumber();

            while (true) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const newBlockNumber = (
                await api.rpc.chain.getBlock()
              ).block.header.number.toNumber();
              if (mode === "quantity" && newBlockNumber >= currentBlockNumber + blocksToWaitFor) {
                break;
              } else if (mode === "height" && newBlockNumber >= blocksToWaitFor) {
                break;
              }
            }
          },
          upgradeRuntime: async (options: UpgradePreferences = {}) => {
            const ctx = MoonwallContext.getContext();
            const provider = ctx.providers.find((prov) => prov.name === "parachain");

            if (!!!provider) {
              throw new Error(`Provider 'parachain' not found`);
            }
            const api = provider.api as ApiPromise;

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
          waitBlock: async (
            blocksToWaitFor: number = 1,
            chainName?: string,
            mode: "height" | "quantity" = "quantity"
          ) => {
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
              if (mode === "quantity" && newBlockNumber >= currentBlockNumber + blocksToWaitFor) {
                break;
              } else if (mode === "height" && newBlockNumber >= blocksToWaitFor) {
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

// export { GenericContext };

// TODO: Extend to include skipIf() and runIf()
export type TestCaseModifier = "only" | "skip";
