import { describe, it, beforeAll, assert, TestAPI } from "vitest";
// import { MoonwallContext } from "../internal/globalContext";
import { getCurrentSuite, setFn } from "vitest/suite";
import { MoonwallContext } from "../../../../src/index.js";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ConnectedProvider, Foundation, ProviderType } from "../lib/types";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
import { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types/index.js";
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
          ) => {
            const results: (
              | { type: "eth"; hash: string }
              | { type: "sub"; hash: string }
            )[] = [];
            const txs =
              transactions == undefined
                ? []
                : Array.isArray(transactions)
                ? transactions
                : [transactions];
            for await (const call of txs) {
              if (typeof call == "string") {
                // Ethereum
                results.push({
                  type: "eth",
                  hash: (
                    await customWeb3Request(
                      context.getWeb3(),
                      "eth_sendRawTransaction",
                      [call]
                    )
                  ).result,
                });
              } else if (call.isSigned) {
                const tx = context.getPolkadotJs().tx(call);
                debug(
                  `- Signed: ${tx.method.section}.${tx.method.method}(${tx.args
                    .map((d) => d.toHuman())
                    .join("; ")}) [ nonce: ${tx.nonce}]`
                );
                results.push({
                  type: "sub",
                  hash: (await call.send()).toString(),
                });
              } else {
                const tx = context.getPolkadotJs().tx(call);
                debug(
                  `- Unsigned: ${tx.method.section}.${
                    tx.method.method
                  }(${tx.args.map((d) => d.toHuman()).join("; ")}) [ nonce: ${
                    tx.nonce
                  }]`
                );
                results.push({
                  type: "sub",
                  hash: (await call.signAndSend(alith)).toString(),
                });
              }
            }

            const { parentHash, finalize } = options;
            const blockResult = await createAndFinalizeBlock(
              context.getPolkadotJs(),
              parentHash,
              finalize
            );

            // No need to extract events if no transactions
            if (results.length == 0) {
              return {
                block: blockResult,
                result: null,
              };
            }

            // We retrieve the events for that block
            const allRecords: EventRecord[] = (await (
              await context.getPolkadotJs().at(blockResult.hash)
            ).query.system.events()) as any;
            // We retrieve the block (including the extrinsics)
            const blockData = await context
              .getPolkadotJs()
              .rpc.chain.getBlock(blockResult.hash);

            const result: ExtrinsicCreation[] = results.map((result) => {
              const extrinsicIndex =
                result.type == "eth"
                  ? allRecords
                      .find(
                        ({ phase, event: { section, method, data } }) =>
                          phase.isApplyExtrinsic &&
                          section == "ethereum" &&
                          method == "Executed" &&
                          data[2].toString() == result.hash
                      )
                      ?.phase?.asApplyExtrinsic?.toNumber()
                  : blockData.block.extrinsics.findIndex(
                      (ext) => ext.hash.toHex() == result.hash
                    );
              // We retrieve the events associated with the extrinsic
              const events = allRecords.filter(
                ({ phase }) =>
                  phase.isApplyExtrinsic &&
                  phase.asApplyExtrinsic.toNumber() === extrinsicIndex
              );
              const failure = extractError(events);
              return {
                extrinsic:
                  extrinsicIndex >= 0
                    ? blockData.block.extrinsics[extrinsicIndex]
                    : null,
                events,
                error:
                  failure &&
                  ((failure.isModule &&
                    context
                      .getPolkadotJs()
                      .registry.findMetaError(failure.asModule)) ||
                    ({ name: failure.toString() } as RegistryError)),
                successful: extrinsicIndex !== undefined && !failure,
                hash: result.hash,
              };
            });
          },
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
          }) => {
            const ws =
              params && params.providerName
                ? MoonwallContext.getContext()
                    .environment.providers.find(
                      ({ name }) => name == params.providerName
                    )
                    .ws()
                : MoonwallContext.getContext()
                    .environment.providers.find(
                      ({ type }) =>
                        type == ProviderType.Moonbeam ||
                        type == ProviderType.PolkadotJs
                    )
                    .ws();

            await ws.connect();
            while (!ws.isConnected) {
              await setTimeout(100);
            }
            if ((params && params.count) || (params && params.to)) {
              await ws.send("dev_newBlock", [
                { count: params.count, to: params.to },
              ]);
            } else {
              await ws.send("dev_newBlock", [{ count: 1 }]);
            }
            await ws.disconnect();
            return;
          },
        },
        it: testCase,
      });
    } else {
      testCases({ context, it: testCase });
    }
  });
}

// export function  timboCase(name, fn){
// const task = getCurrentSuite().custom(name)

// task.meta = {
//   customPropertyToDifferentiateTask: true,
// }

// setFn(task, fn || (()=>))

// }

// export const myCustomTask = function (name, fn) {
//   const task = getCurrentSuite().custom(name)
//   task.meta = {
//     customPropertyToDifferentiateTask: true
//   }
//   setFn(task, fn || (() => {}))
// }

// interface CustomTest {
//   (id: string, title: string, cb: () => void, only?: boolean): void;
// }

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

interface GenericContext {
  providers: Object;
  getPolkadotJs: ([name]?: string) => ApiPromise;
  getMoonbeam: ([name]?: string) => ApiPromise;
  getEthers: ([name]?: string) => WebSocketProvider;
  getWeb3: ([name]?: string) => Web3;
}

interface ChopsticksContext extends GenericContext {
  createBlock: (params?: {
    providerName?: string;
    count?: number;
    to?: number;
  }) => Promise<void>;
}

interface DevModeContext extends GenericContext {
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
}
