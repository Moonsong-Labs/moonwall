import type {
  BlockCreation,
  DevModeContext,
  ExtrinsicCreation,
  GenericContext,
} from "../../api/types/index.js";
import {
  alith,
  createAndFinalizeBlock,
  customWeb3Request,
  generateKeyringPair,
} from "../../util/index.js";
import { Keyring } from "@polkadot/api";
import type { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types";
import type { RegistryError } from "@polkadot/types-codec/types/registry";
import type { EventRecord } from "@polkadot/types/interfaces";
import chalk from "chalk";
import { createLogger } from "../../util/index.js";
import { setTimeout } from "node:timers/promises";
import { getEnvironmentFromConfig, isEthereumDevConfig } from "../../services/config/index.js";
import { extractError } from "../../api/testing/events.js";
import { MoonwallContext } from "../../cli/lib/globalContext.js";
import { vitestAutoUrl } from "../../cli/internal/providerFactories.js";
const logger = createLogger({ name: "DevTest" });
const debug = logger.debug.bind(logger);

export async function getDevProviderPath() {
  const env = getEnvironmentFromConfig();
  return env.connections
    ? env.connections[0].endpoints[0].replace("ws://", "http://")
    : vitestAutoUrl();
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

function returnSigner(options: BlockCreation) {
  return options.signer && "privateKey" in options.signer && "type" in options.signer
    ? generateKeyringPair(options.signer.type, options.signer.privateKey)
    : options.signer;
}

function returnDefaultSigner() {
  return isEthereumDevConfig()
    ? alith
    : new Keyring({ type: "sr25519" }).addFromUri("//Alice", {
        name: "Alice default",
      });
}

export async function createDevBlock<
  ApiType extends ApiTypes,
  Calls extends CallType<ApiType> | Array<CallType<ApiType>>,
>(context: GenericContext, options: BlockCreation, transactions?: Calls) {
  const containsViem = !!(
    (context as DevModeContext).isEthereumChain &&
    context.viem() &&
    (await MoonwallContext.getContext()).providers.find((prov) => prov.type === "viem")
  );
  const api = context.polkadotJs();

  const originalBlockNumber = (await api.rpc.chain.getHeader()).number.toBigInt();

  const signer = options.signer ? returnSigner(options) : returnDefaultSigner();

  const results: ({ type: "eth"; hash: string } | { type: "sub"; hash: string })[] = [];

  const txs = !transactions ? [] : Array.isArray(transactions) ? transactions : [transactions];

  for await (const call of txs) {
    if (typeof call === "string") {
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
  if (results.length === 0) {
    return {
      block: blockResult,
    };
  }

  const allRecords: EventRecord[] = (await (
    await api.at(blockResult.hash)
  ).query.system.events()) as any;
  const blockData = await api.rpc.chain.getBlock(blockResult.hash);

  const getExtIndex = (records: EventRecord[], result: { type: "sub" | "eth"; hash: string }) => {
    if (result.type === "eth") {
      const res = records
        .find(
          ({ phase, event: { section, method, data } }) =>
            phase.isApplyExtrinsic &&
            section === "ethereum" &&
            method === "Executed" &&
            data[2].toString() === result.hash
        )
        ?.phase?.asApplyExtrinsic?.toString();

      return typeof res === "undefined" ? undefined : Number(res);
    }
    return blockData.block.extrinsics.findIndex((ext) => ext.hash.toHex() === result.hash);
  };

  const result: ExtrinsicCreation[] = results.map((result) => {
    const extrinsicIndex = getExtIndex(allRecords, result);
    const extrinsicFound = typeof extrinsicIndex !== "undefined";

    // We retrieve the events associated with the extrinsic
    const events = allRecords.filter(
      ({ phase }) =>
        phase.isApplyExtrinsic && Number(phase.asApplyExtrinsic.toString()) === extrinsicIndex
    );

    const failure = extractError(events);
    return {
      extrinsic: extrinsicFound ? blockData.block.extrinsics[extrinsicIndex] : null,
      events,
      error:
        failure &&
        ((failure.isModule && api.registry.findMetaError(failure.asModule)) ||
          ({ name: failure.toString() } as RegistryError)),
      successful: extrinsicFound && !failure,
      hash: result.hash,
    };
  });

  if (results.find((res) => res.type === "eth")) {
    // Wait until new block is actually created
    // max wait 2s
    for (let i = 0; i < 1000; i++) {
      const currentBlock = (await api.rpc.chain.getHeader()).number.toBigInt();
      await setTimeout(30);
      if (currentBlock > originalBlockNumber) {
        break;
      }
    }
  }

  const actualEvents = result.flatMap((resp) => resp.events);

  if (options.expectEvents && options.expectEvents.length > 0) {
    const match = options.expectEvents.every((eEvt) => {
      const found = actualEvents
        .map((aEvt) => eEvt.is(aEvt.event))
        .reduce((acc, curr) => acc || curr, false);
      if (!found) {
        const message = `Event ${chalk.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`;
        if (options.logger) {
          // Handle both pino Logger (has .error) and LogFn (callable)
          if ("error" in options.logger) {
            options.logger.error(message);
          } else {
            options.logger(message);
          }
        } else {
          console.error(message);
        }
      }
      return found;
    });

    if (!match) {
      throw new Error("Expected events not present in block");
    }
  }

  if (!options.allowFailures) {
    for (const event of actualEvents) {
      if (api.events.system.ExtrinsicFailed.is(event.event)) {
        throw new Error(
          "ExtrinsicFailed event detected, enable 'allowFailures' if this is expected."
        );
      }
    }
  }

  return {
    block: blockResult,
    result: Array.isArray(transactions) ? result : (result[0] as any),
  };
}
