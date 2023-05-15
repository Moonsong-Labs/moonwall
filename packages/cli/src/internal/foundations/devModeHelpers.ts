import "@moonbeam-network/api-augment";
import "@polkadot/api-augment";
import { BlockCreation, ExtrinsicCreation, extractError } from "../../lib/contextHelpers.js";
import { ApiTypes, AugmentedEvent, SubmittableExtrinsic } from "@polkadot/api/types";
import { customWeb3Request, alith, createAndFinalizeBlock } from "@moonwall/util";
import Debug from "debug";
import { setTimeout } from "timers/promises";
import { EventRecord } from "@polkadot/types/interfaces/types.js";
import { RegistryError } from "@polkadot/types-codec/types/registry";
import { MoonwallContext } from "../../lib/globalContext.js";
import { ApiPromise } from "@polkadot/api";
import { assert } from "vitest";
import chalk from "chalk";
import { importJsonConfig } from "../../lib/configReader.js";
import { GenericContext } from "../../types/runner.js";
const debug = Debug("DevTest");

export async function devForkToFinalizedHead(context: MoonwallContext) {
  const api = context.providers.find(({ type }) => type == "moon")!.api as ApiPromise;
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

export async function getDevProviderPath() {
  const globalConfig = await importJsonConfig();
  const env = globalConfig.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
  return env.connections
    ? env.connections[0].endpoints[0].replace("ws://", "http://")
    : `http://127.0.0.1:${10000 + Number(process.env.VITEST_POOL_ID || 1) * 100}`;
}

export async function createDevBlock<
  ApiType extends ApiTypes,
  Call extends
    | SubmittableExtrinsic<ApiType>
    | Promise<SubmittableExtrinsic<ApiType>>
    | string
    | Promise<string>,
  Calls extends Call | Call[]
>(context: GenericContext, transactions?: Calls, options: BlockCreation = { allowFailures: true }) {
  let containsViem: boolean;
  let originalBlockNumber: bigint;

  try {
    const pubClient = context.viemClient("public");
    containsViem = true;
    originalBlockNumber = await pubClient.getBlockNumber();
  } catch {
    containsViem = false;
  }

  const results: ({ type: "eth"; hash: string } | { type: "sub"; hash: string })[] = [];

  const api = context.polkadotJs();
  const txs =
    transactions == undefined ? [] : Array.isArray(transactions) ? transactions : [transactions];
  for await (const call of txs) {
    if (typeof call == "string") {
      // Ethereum
      results.push({
        type: "eth",
        hash: ((await customWeb3Request(context.web3(), "eth_sendRawTransaction", [call])) as any)
          .result,
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
  const allRecords: EventRecord[] = await (await api.at(blockResult.hash)).query.system.events();
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
        : blockData.block.extrinsics.findIndex((ext) => ext.hash.toHex() == result.hash);
    // We retrieve the events associated with the extrinsic
    const events = allRecords.filter(
      ({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.toNumber() === extrinsicIndex
    );
    const failure = extractError(events);
    return {
      extrinsic: extrinsicIndex! >= 0 ? blockData.block.extrinsics[extrinsicIndex!] : null,
      events,
      error:
        failure &&
        ((failure.isModule && api.registry.findMetaError(failure.asModule)) ||
          ({ name: failure.toString() } as RegistryError)),
      successful: extrinsicIndex !== undefined && !failure,
      hash: result.hash,
    };
  });

  // Avoiding race condition by ensuring ethereum block is created
  if (containsViem) {
    await new Promise((resolve, reject) => {
      const pubClient = context.viemClient("public");

      const unwatch = pubClient.watchBlockNumber({
        onBlockNumber: (blockNum) => {
          if (blockNum > originalBlockNumber) {
            unwatch();
            resolve("success");
          }
        },
      });
    });
  } else if (results.find((r) => r.type == "eth")) {
    await setTimeout(10);
  }

  const actualEvents = result.flatMap((resp) => resp.events);

  if (options.expectEvents && options.expectEvents.length > 0) {
    const match = options.expectEvents.every((eEvt) => {
      const found = actualEvents
        .map((aEvt) => eEvt.is(aEvt.event))
        .reduce((acc, curr) => acc || curr, false);
      if (!found) {
        options.logger
          ? options.logger(
              `Event ${chalk.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            )
          : console.error(
              `Event ${chalk.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            );
      }
      return found;
    });
    assert(match, "Expected events not present in block");
  }

  if (!options.allowFailures) {
    actualEvents.forEach((event) => {
      assert(
        !api.events.system.ExtrinsicFailed.is(event.event),
        "ExtrinsicFailed event detected, enable 'allowFailures' if this is expected."
      );
    });
  }

  return {
    block: blockResult,
    result: Array.isArray(transactions) ? result : (result[0] as any),
  };
}
