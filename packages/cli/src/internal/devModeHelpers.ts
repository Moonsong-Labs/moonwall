import {
  BlockCreation,
  ExtrinsicCreation,
  extractError,
} from "../lib/contextHelpers.js";
import {
  ApiTypes,
  AugmentedEvent,
  SubmittableExtrinsic,
} from "@polkadot/api/types/index.js";
import {
  customWeb3Request,
  alith,
  createAndFinalizeBlock,
} from "@moonsong-labs/moonwall-util";
import { GenericContext } from "../lib/runner-functions.js";
import Debug from "debug";
import { setTimeout } from "timers/promises";
import { EventRecord } from "@polkadot/types/interfaces/types.js";
import { RegistryError } from "@polkadot/types-codec/types/registry";
import { MoonwallContext } from "../lib/globalContext.js";
import { ApiPromise } from "@polkadot/api";
const debug = Debug("DevTest");

export async function devForkToFinalizedHead(context: MoonwallContext) {
  const api = context.providers.find(({ type }) => type == "moon")!
    .api as ApiPromise;
  const finalizedHead = context.genesis;
  await api.rpc.engine.createBlock(true, true, finalizedHead);
  while (true) {
    const newHead = (await api.rpc.chain.getFinalizedHead()).toString();
    if (newHead == finalizedHead) {
      await setTimeout(100);
    } else {
      context.genesis = newHead;
      break;
    }
  }
}

export async function createDevBlockCheckEvents<
  ApiType extends ApiTypes,
  Call extends
    | SubmittableExtrinsic<ApiType>
    | Promise<SubmittableExtrinsic<ApiType>>
    | string
    | Promise<string>,
  Calls extends Call | Call[]
>(
  context: GenericContext,
  expectedEvents: AugmentedEvent<ApiType>[],
  transactions?: Calls,
  options: BlockCreation = {}
) {
  const { result } = await createDevBlock(context, transactions, options);
  const actualEvents = result.events;
  return {
    events: actualEvents,
    match: expectedEvents.every((eEvt) => {
      return actualEvents
        .map((aEvt) => eEvt.is(aEvt.event))
        .reduce((acc, curr) => acc || curr, false);
    }),
  };
}

export async function createDevBlock<
  ApiType extends ApiTypes,
  Call extends
    | SubmittableExtrinsic<ApiType>
    | Promise<SubmittableExtrinsic<ApiType>>
    | string
    | Promise<string>,
  Calls extends Call | Call[]
>(context: GenericContext, transactions?: Calls, options: BlockCreation = {}) {
  const results: (
    | { type: "eth"; hash: string }
    | { type: "sub"; hash: string }
  )[] = [];

  const api = context.getMoonbeam() || context.getPolkadotJs();
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
          await customWeb3Request(context.getWeb3(), "eth_sendRawTransaction", [
            call,
          ])
        ).result,
      });
    } else if (call.isSigned) {
      const tx = api.tx(call);
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
      const tx = api.tx(call);
      debug(
        `- Unsigned: ${tx.method.section}.${tx.method.method}(${tx.args
          .map((d) => d.toHuman())
          .join("; ")}) [ nonce: ${tx.nonce}]`
      );
      results.push({
        type: "sub",
        hash: (await call.signAndSend(alith)).toString(),
      });
    }
  }

  const { parentHash, finalize } = options;
  const blockResult = await createAndFinalizeBlock(api, parentHash, finalize);

  // No need to extract events if no transactions
  if (results.length == 0) {
    return {
      block: blockResult,
      result: null,
    };
  }

  // We retrieve the events for that block
  const allRecords: EventRecord[] = (await (
    await api.at(blockResult.hash)
  ).query.system.events()) as any;
  // We retrieve the block (including the extrinsics)
  const blockData = await api.rpc.chain.getBlock(blockResult.hash);

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
        extrinsicIndex! >= 0
          ? blockData.block.extrinsics[extrinsicIndex!]
          : null,
      events,
      error:
        failure &&
        ((failure.isModule && api.registry.findMetaError(failure.asModule)) ||
          ({ name: failure.toString() } as RegistryError)),
      successful: extrinsicIndex !== undefined && !failure,
      hash: result.hash,
    };
  });

  // Adds extra time to avoid empty transaction when querying it
  if (results.find((r) => r.type == "eth")) {
    await setTimeout(2);
  }
  return {
    block: blockResult,
    result: Array.isArray(transactions) ? result : (result[0] as any),
  };
}
