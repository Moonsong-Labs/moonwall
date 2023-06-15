import "@moonbeam-network/api-augment";
import type {
  BlockCreation,
  ChopsticksBlockCreation,
  ChopsticksContext,
  DevModeContext,
  FoundationType,
  GenericContext,
  ITestSuiteType,
  PolkadotProviders,
  ProviderMap,
  ProviderType,
  ReadOnlyContext,
  UpgradePreferences,
  ViemApiMap,
  ViemClientType,
  ZombieContext
} from "@moonwall/types";
import { ALITH_PRIVATE_KEY } from "@moonwall/util";
import { ApiPromise } from "@polkadot/api";
import { ApiTypes } from "@polkadot/api/types/index.js";
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

const RT_VERSION = Number(process.env.MOON_RTVERSION);
const RT_NAME = process.env.MOON_RTNAME;
let ctx: MoonwallContext;

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
export function describeSuite<T extends FoundationType>({
  id,
  title,
  testCases,
  foundationMethods,
  minRtVersion,
  chainType,
  notChainType,
}: ITestSuiteType<T>): void {
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
      throw new Error("MOON_TEST_ENV not set");
    }

    ctx = await contextCreator(globalConfig, process.env.MOON_TEST_ENV);
  });

  afterAll(async function () {
    await MoonwallContext.destroy();
  });

  describe(`🗃️  #${id} ${title}`, function () {
    const getApi = <T extends ProviderType>(apiType: T, apiName?: string) => {
      const provider = ctx.providers.find(
        (prov) =>
          prov.type == apiType ||
          (apiType == "polkadotJs" && prov.type == "moon" && (!apiName || prov.name === apiName))
      );

      if (!provider) {
        throw new Error(
          `API of type ${apiType} ${apiName ? "and name " + apiName : ""} could not be found`
        );
      }

      return provider.api as ProviderMap[T];
    };

    const context: GenericContext = {
      api: <T extends ProviderType>(type: T, name?: string) => getApi(type, name),
      viem: <T extends ViemClientType>(clientType?: T, name?: string): ViemApiMap[T] => {
        return (
          clientType == "public"
            ? getApi("viemPublic", name)
            : clientType == "wallet"
            ? getApi("viemWallet", name)
            : getApi("viemPublic")
        ) as ViemApiMap[T];
      },
      polkadotJs: (options?: { apiName?: string; type?: PolkadotProviders }): ApiPromise =>
        options
          ? options.type
            ? getApi(options.type, options.apiName)
            : getApi("polkadotJs", options.apiName)
          : getApi("polkadotJs"),
      ethers: (apiName?: string): Signer => getApi("ethers", apiName),
      web3: (apiName?: string): Web3 => getApi("web3", apiName),
    };

    const foundationHandlers: Record<FoundationType, FoundationHandler<any>> = {
      dev: devHandler,
      chopsticks: chopsticksHandler,
      zombie: zombieHandler,
      read_only: readOnlyHandler,
      fork: readOnlyHandler,
    };

    const handler = foundationHandlers[foundationMethods];
    if (!handler) {
      throw new Error(`Unsupported foundation methods: ${foundationMethods}`);
    }

    handler({
      testCases: testCases as TestCasesFn<any>, // Typescript will prevent us from directly passing `testCases`, so we need to cast it to the correct type.
      context,
      testCase,
      logger,
    });
  });
}

type TestCasesFn<T extends FoundationType> = (params: {
  context: GenericContext & FoundationContextMap[T];
  it: typeof testCase;
  log: Debug.Debugger;
}) => void;

//
// Handlers for different foundation methods
//

type FoundationHandler<T extends FoundationType> = (params: {
  testCases: TestCasesFn<T>;
  context: GenericContext;
  testCase: typeof testCase;
  logger: () => Debug.Debugger;
}) => void;

const devHandler: FoundationHandler<"dev"> = ({ testCases, context, testCase, logger }) => {
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

const chopsticksHandler: FoundationHandler<"chopsticks"> = ({
  testCases,
  context,
  testCase,
  logger,
}) => {
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
};

const zombieHandler: FoundationHandler<"zombie"> = ({ testCases, context, testCase, logger }) => {
  testCases({
    context: {
      ...context,
      waitBlock: async (
        blocksToWaitFor: number = 1,
        chain: string = "parachain",
        mode: "height" | "quantity" = "quantity"
      ) => {
        // const ctx = MoonwallContext.getContext();
        const provider = ctx.providers.find((prov) => prov.name === chain);

        if (!!!provider) {
          throw new Error(`Provider '${chain}' not found`);
        }

        const api = provider.api as ApiPromise;
        const currentBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();

        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const newBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
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
};

const readOnlyHandler: FoundationHandler<"read_only"> = ({
  testCases,
  context,
  testCase,
  logger,
}) => {
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

        const currentBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();

        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const newBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
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
};

type FoundationContextMap = {
  dev: DevModeContext;
  chopsticks: ChopsticksContext;
  zombie: ZombieContext;
  read_only: ReadOnlyContext;
  fork: GenericContext;
};

// TODO: Extend to include skipIf() and runIf()
export type TestCaseModifier = "only" | "skip";

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
      `📁  #${params.id.concat(params.id)} ${params.title}`,
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
    it.skip(`📁  #${params.id.concat(params.id)} ${params.title}`, params.test, params.timeout);
    return;
  }

  it(`📁  #${params.id.concat(params.id)} ${params.title}`, params.test, params.timeout);
};

const logger = () => {
  process.env.DEBUG_COLORS = "1";
  const debug = Debug(`test:${process.env.MOON_TEST_ENV}`);
  debug.log = console.log.bind(process.stdout);
  Debug.enable("test:*");

  return debug;
};
