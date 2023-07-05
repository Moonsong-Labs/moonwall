import "@moonbeam-network/api-augment";
import { BlockCreation, ExtrinsicCreation, GenericContext } from "@moonwall/types";
import { createAndFinalizeBlock, customWeb3Request, generateKeyringPair } from "@moonwall/util";
import { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types";
import { RegistryError } from "@polkadot/types-codec/types/registry";
import { EventRecord } from "@polkadot/types/interfaces/types.js";
import chalk from "chalk";
import Debug from "debug";
import { setTimeout } from "timers/promises";
import { assert } from "vitest";
import { importJsonConfig } from "../../lib/configReader.js";
import { extractError } from "../../lib/contextHelpers.js";
import { MoonwallContext } from "../../lib/globalContext.js";
const debug = Debug("DevTest");

export async function getDevProviderPath() {
  const globalConfig = importJsonConfig();
  const env = globalConfig.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
  return env.connections
    ? env.connections[0].endpoints[0].replace("ws://", "http://")
    : `http://127.0.0.1:${10000 + Number(process.env.VITEST_POOL_ID || 1) * 100}`;
}

export type CreatedBlockResult = {
  block: {
    duration: number;
    hash: string;
  };
  result: ExtrinsicCreation | ExtrinsicCreation[] | null;
};

export type CallType<TApi extends ApiTypes> =
  | SubmittableExtrinsic<TApi>
  | Promise<SubmittableExtrinsic<TApi>>
  | `0x${string}`
  | Promise<string>;

export async function createDevBlock<
  ApiType extends ApiTypes,
  Calls extends CallType<ApiType> | CallType<ApiType>[]
>(context: GenericContext, transactions?: Calls, options: BlockCreation = {}) {
  let originalBlockNumber: bigint;

  const containsViem =
    MoonwallContext.getContext().providers.find((prov) => prov.type == "viem") && !!!context.viem()
      ? true
      : false;

  if (containsViem) {
    originalBlockNumber = await context.viem().getBlockNumber();
  }
  const signer = generateKeyringPair(options.signer!.type, options.signer!.privateKey);

  const results: ({ type: "eth"; hash: string } | { type: "sub"; hash: string })[] = [];

  const api = context.polkadotJs();
  const txs =
    transactions == undefined ? [] : Array.isArray(transactions) ? transactions : [transactions];
  for await (const call of txs) {
    if (typeof call == "string") {
      // Ethereum
      results.push({
        type: "eth",
        hash: containsViem
          ? (
              (await context.viem().request({
                method: "eth_sendRawTransaction",
                params: [call as `0x${string}`],
              })) as any
            ).result
          : ((await customWeb3Request(context.web3(), "eth_sendRawTransaction", [call])) as any)
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
        hash: (await call.signAndSend(signer)).toString(),
      });
    }
  }

  const { parentHash, finalize } = options;
  const blockResult = await createAndFinalizeBlock(api, parentHash, finalize);

  // No need to extract events if no transactions
  if (results.length == 0) {
    return {
      block: blockResult,
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
  if (containsViem && originalBlockNumber! !== undefined) {
    const pubClient = context.viem();
    while (true) {
      const blockNum = await pubClient.getBlockNumber();
      if (blockNum > originalBlockNumber) {
        break;
      }
      await setTimeout(1);
    }
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
