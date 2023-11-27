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
import { ApiPromise } from "@polkadot/api";
import { Config, Effect } from "effect";
import * as Err from "../errors";
import Bottleneck from "bottleneck";
import Debug from "debug";
import { Signer } from "ethers";
import { afterAll, beforeAll, describe, it } from "vitest";
import { Web3 } from "web3";
import { importAsyncConfig } from "./configReader";
import { chopsticksHandler } from "./handlers/chopsticksHandler";
import { devHandler } from "./handlers/devHandler";
import { readOnlyHandler } from "./handlers/readOnlyHandler";
import { zombieHandler } from "./handlers/zombieHandler";
import { MoonwallContext, createContextEffect } from "./globalContextEffect";

const RT_VERSION = Number(process.env.MOON_RTVERSION);
const RT_NAME = process.env.MOON_RTNAME;

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
export const describeSuite = <T extends FoundationType>(params: ITestSuiteType<T>) =>
  Effect.runSync(Effect.interruptible(describeSuiteEffect(params)).pipe(Effect.disconnect));

const describeSuiteEffect = <T extends FoundationType>({
  id: suiteId,
  title,
  testCases,
  foundationMethods,
  minRtVersion,
  chainType,
  notChainType,
}: ITestSuiteType<T>) =>
  Effect.gen(function* (_) {
    if (
      (minRtVersion && minRtVersion > RT_VERSION) ||
      (chainType && chainType !== RT_NAME) ||
      (notChainType && notChainType === RT_NAME)
    ) {
      yield* _(Effect.sync(() => describe.skip(`🗃️  #${suiteId} ${title}`)));
      return;
    }

    let ctx: MoonwallContext;
    let limiter: Bottleneck | undefined = undefined;

    beforeAll(
      async () =>
        await Effect.runPromise(
          Effect.gen(function* (_) {
            const globalConfig = yield* _(
              Effect.tryPromise({
                try: () => importAsyncConfig(),
                catch: () => new Err.ConfigError("Could not load config before running test"),
              })
            );

            yield* _(Effect.config(Config.string("MOON_TEST_ENV")));
            const env = globalConfig.environments.find(
              ({ name }) => name === process.env.MOON_TEST_ENV
            );

            if (env.foundation.type === "read_only") {
              const settings = loadParams(env.foundation.launchSpec);
              limiter = new Bottleneck(settings);
            }
            ctx = yield* _(createContextEffect());
            return;
          })
        )
    );

    afterAll(
      async () =>
        await Effect.runPromise(
          MoonwallContext.getContext()
            .destroyEffect()
            .pipe(
              Effect.timeoutFail({
                duration: "10 seconds",
                onTimeout: () => new Err.MoonwallContextDestroyError(),
              })
            )
        )
    );

    const testCase = (params: ITestCase) => {
      if (params.modifier) {
        it[params.modifier](
          `📁  #${suiteId.concat(params.id)} ${params.title}`,
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
        Effect.sync(() =>
          it.skip(`📁  #${suiteId.concat(params.id)} ${params.title}`, params.test, params.timeout)
        );
        return;
      }

      it(`📁  #${suiteId.concat(params.id)} ${params.title}`, params.test, params.timeout);
    };

    describe(`🗃️  #${suiteId} ${title}`, async () =>
      await Effect.runPromise(
        Effect.gen(function* (_) {
          const getApi = <T extends ProviderType>(apiType?: T, apiName?: string) => {
            const provider = ctx!.providers.find((prov) => {
              if (apiType && apiName) {
                return prov.type == apiType && prov.name === apiName;
              } else if (apiType && !apiName) {
                return prov.type == apiType;
              } else if (!apiType && apiName) {
                return prov.name === apiName;
              } else {
                return false;
              }
            });

            if (!provider) {
              throw new Error(
                `API of type ${apiType} ${apiName ? "and name " + apiName : ""} could not be found`
              );
            }

            return !limiter
              ? (provider.api as ProviderMap[T])
              : scheduleWithBottleneck(provider.api as ProviderMap[T]);
          };

          const scheduleWithBottleneck = <T extends ProviderApi>(api: T): T => {
            return new Proxy(api, {
              get(target, propKey) {
                const origMethod = target[propKey];
                if (typeof origMethod === "function" && propKey !== "rpc" && propKey !== "tx") {
                  return (...args: any[]) => {
                    return limiter!.schedule(() => origMethod.apply(target, args));
                  };
                }
                return origMethod;
              },
            });
          };

          const context: GenericContext = {
            api: <T extends ProviderType>(type: T, name?: string) => getApi(type, name),
            viem: (apiName?: string): ViemClient => getApi("viem", apiName),
            polkadotJs: (apiName?: string): ApiPromise => getApi("polkadotJs", apiName),
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

          const handler = yield* _(Effect.sync(() => foundationHandlers[foundationMethods]));
          if (!handler) {
            Effect.fail(new Err.InvalidFoundationError({ foundation: foundationMethods }));
          }

          yield* _(
            Effect.sync(() =>
              handler({
                testCases: testCases as TestCasesFn<any>,
                context,
                testCase,
                logger,
                ctx,
              })
            )
          );
        })
      ));
  });

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
