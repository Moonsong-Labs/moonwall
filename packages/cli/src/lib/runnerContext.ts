import "@moonbeam-network/api-augment";
import type {
  FoundationHandler,
  FoundationType,
  GenericContext,
  ITestCase,
  ITestSuiteType,
  ProviderApi,
  ProviderMap,
  ProviderType,
  ReadOnlyLaunchSpec,
  TestCasesFn,
  ViemClient,
} from "@moonwall/types";
import type { ApiPromise } from "@polkadot/api";
import Bottleneck from "bottleneck";
import Debug from "debug";
import type { Wallet } from "ethers";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { Web3 } from "web3";
import { getEnvironmentFromConfig, importAsyncConfig } from "./configReader";
import { MoonwallContext, contextCreator } from "./globalContext";
import { chopsticksHandler } from "./handlers/chopsticksHandler";
import { devHandler } from "./handlers/devHandler";
import { readOnlyHandler } from "./handlers/readOnlyHandler";
import { zombieHandler } from "./handlers/zombieHandler";
import type { PolkadotClient } from "polkadot-api";

const RT_VERSION = Number(process.env.MOON_RTVERSION);
const RT_NAME = process.env.MOON_RTNAME;
let limiter: Bottleneck | undefined = undefined;

// About: This has been designed in the handler pattern so that eventually we can integrate it to vitest
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
 *            testds: async function () {
 *              expect(true).to.be.true;
 *            },
 *          });
 *        },
 *      });
 */
export function describeSuite<T extends FoundationType>({
  id: suiteId,
  title,
  testCases,
  foundationMethods,
  minRtVersion,
  chainType,
  notChainType,
  options,
}: ITestSuiteType<T>): void {
  if (
    (minRtVersion && minRtVersion > RT_VERSION) ||
    (chainType && chainType !== RT_NAME) ||
    (notChainType && notChainType === RT_NAME)
  ) {
    describe.skip(`🗃️  ${suiteId} ${title}`);
    return;
  }
  let ctx: MoonwallContext | null = null;

  beforeAll(async () => {

    const env = getEnvironmentFromConfig();
    if (env.foundation.type === "dev") {
      // Pass options to contextCreator if they exist
      ctx = await contextCreator(options);
    }

    ctx = await contextCreator();
    if (env.foundation.type === "read_only") {
      const settings = loadParams(env.foundation.launchSpec);
      limiter = new Bottleneck(settings);
    }
  });

  afterAll(async () => {
    await MoonwallContext.destroy();
    ctx = null;
  });

  const testCase = (params: ITestCase) => {
    if (params.modifier) {
      it[params.modifier](
        `📁  ${suiteId.concat(params.id)} ${params.title}`,
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
      it.skip(`📁  ${suiteId.concat(params.id)} ${params.title}`, params.test, params.timeout);
      return;
    }

    it(`📁  ${suiteId.concat(params.id)} ${params.title}`, params.test, params.timeout);
  };

  describe(`🗃️  ${suiteId} ${title}`, () => {
    const getApi = <T extends ProviderType>(apiType?: T, apiName?: string) => {
      if (!ctx) {
        throw new Error("Context not initialized");
      }
      const provider = ctx.providers.find((prov) => {
        if (apiType && apiName) {
          return prov.type === apiType && prov.name === apiName;
        }
        if (apiType && !apiName) {
          return prov.type === apiType;
        }
        if (!apiType && apiName) {
          return prov.name === apiName;
        }
        return false;
      });

      if (!provider) {
        throw new Error(
          `API of type ${apiType} ${apiName ? `and name ${apiName}` : ""} could not be found`
        );
      }

      return !limiter
        ? (provider.api as ProviderMap[T])
        : scheduleWithBottleneck(provider.api as ProviderMap[T]);
    };

    const context: GenericContext = {
      api: <T extends ProviderType>(type: T, name?: string) => getApi(type, name),
      viem: (apiName?: string): ViemClient => getApi("viem", apiName),
      polkadotJs: (apiName?: string): ApiPromise => getApi("polkadotJs", apiName),
      ethers: (apiName?: string): Wallet => getApi("ethers", apiName),
      web3: (apiName?: string): Web3 => getApi("web3", apiName),
      papi: (apiName?: string): PolkadotClient => getApi("papi", apiName),
    };

    const foundationHandlers: Record<FoundationType, FoundationHandler<any>> = {
      dev: devHandler,
      chopsticks: chopsticksHandler,
      zombie: zombieHandler,
      read_only: readOnlyHandler,
    };

    const handler = foundationHandlers[foundationMethods];
    if (!handler) {
      throw new Error(`Unsupported foundation methods: ${foundationMethods}`);
    }

    handler({
      testCases: testCases as TestCasesFn<any>,
      context,
      testCase,
      logger,
      ctx,
    });
  });
}

const logger = () => {
  process.env.DEBUG_COLORS = "1";
  const debug = Debug(`test:${process.env.MOON_TEST_ENV}`);
  debug.log = console.log.bind(process.stdout);
  Debug.enable("test:*");

  return debug;
};

const loadParams = (config?: ReadOnlyLaunchSpec) => {
  const defaultParams = { maxConcurrent: 5, minTime: 100 };

  if (!config || config.rateLimiter === undefined || config.rateLimiter === true) {
    return defaultParams;
  }

  if (config.rateLimiter === false) {
    return {};
  }

  if (typeof config.rateLimiter === "object") {
    return config.rateLimiter;
  }
};

const scheduleWithBottleneck = <T extends ProviderApi>(api: T): T => {
  return new Proxy(api, {
    get(target, propKey) {
      const origMethod = target[propKey];
      if (typeof origMethod === "function" && propKey !== "rpc" && propKey !== "tx") {
        return (...args: any[]) => {
          if (!limiter) {
            throw new Error("Limiter not initialized");
          }

          return limiter.schedule(() => origMethod.apply(target, args));
        };
      }
      return origMethod;
    },
  });
};
