import { ApiPromise } from "@polkadot/api";
import {
  AddressOrPair,
  ApiTypes,
  SubmittableExtrinsic,
} from "@polkadot/api/types";
import { GenericExtrinsic } from "@polkadot/types/extrinsic";
import {
  DispatchError,
  DispatchInfo,
  Event,
  EventRecord,
} from "@polkadot/types/interfaces";
import { AnyTuple, RegistryError } from "@polkadot/types/types";
import {
  customWeb3Request,
  ALITH_PRIVATE_KEY,
  alith,
  createAndFinalizeBlock,
} from "@moonsong-labs/moonwall-util";
import Web3 from "web3";
import { ethers } from "ethers";
import { MoonwallContext } from "./globalContext.js";
import { assert } from "vitest";
import Debug from "debug";
const debug = Debug("context");

export async function createBlock<
  ApiType extends ApiTypes,
  Call extends
    | SubmittableExtrinsic<ApiType>
    | Promise<SubmittableExtrinsic<ApiType>>
    | string
    | Promise<string>,
  Calls extends Call | Call[]
>(
  w3Api: Web3,
  pjsApi: ApiPromise,
  transactions?: Calls,
  options: BlockCreation = {}
): Promise<
  BlockCreationResponse<
    ApiType,
    Calls extends Call[] ? Awaited<Call>[] : Awaited<Call>
  >
> {
  assert(
    MoonwallContext.getContext().foundation == "dev",
    "createBlock should only be used on DevMode foundations"
  );
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
        hash: (await customWeb3Request(w3Api, "eth_sendRawTransaction", [call]))
          .result,
      });
    } else if (call.isSigned) {
      const tx = pjsApi.tx(call);
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
      const tx = pjsApi.tx(call);
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
  const blockResult = await createAndFinalizeBlock(
    pjsApi,
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
    await pjsApi.at(blockResult.hash)
  ).query.system.events()) as any;
  // We retrieve the block (including the extrinsics)
  const blockData = await pjsApi.rpc.chain.getBlock(blockResult.hash);

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
        extrinsicIndex >= 0 ? blockData.block.extrinsics[extrinsicIndex] : null,
      events,
      error:
        failure &&
        ((failure.isModule &&
          pjsApi.registry.findMetaError(failure.asModule)) ||
          ({ name: failure.toString() } as RegistryError)),
      successful: extrinsicIndex !== undefined && !failure,
      hash: result.hash,
    };
  });

  // Adds extra time to avoid empty transaction when querying it
  if (results.find((r) => r.type == "eth")) {
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  return {
    block: blockResult,
    result: Array.isArray(transactions) ? result : (result[0] as any),
  };
}

export interface BlockCreation {
  parentHash?: string;
  finalize?: boolean;
}

export interface BlockCreationResponse<
  ApiType extends ApiTypes,
  Call extends
    | SubmittableExtrinsic<ApiType>
    | string
    | (SubmittableExtrinsic<ApiType> | string)[]
> {
  block: {
    duration: number;
    hash: string;
  };
  result: Call extends (string | SubmittableExtrinsic<ApiType>)[]
    ? ExtrinsicCreation[]
    : ExtrinsicCreation;
}

export interface ExtrinsicCreation {
  extrinsic: GenericExtrinsic<AnyTuple>;
  events: EventRecord[];
  error: RegistryError;
  successful: boolean;
  hash: string;
}

// export const createBlockWithExtrinsic = async <
//   Call extends SubmittableExtrinsic<ApiType>[],
//   ApiType extends ApiTypes
// >(
//   context: DevTestContext,
//   polkadotCalls: [...Call]
// ) => {};

export function filterAndApply<T>(
  events: EventRecord[],
  section: string,
  methods: string[],
  onFound: (record: EventRecord) => T
): T[] {
  return events
    .filter(
      ({ event }) => section === event.section && methods.includes(event.method)
    )
    .map((record) => onFound(record));
}

export function getDispatchError({
  event: {
    data: [dispatchError],
  },
}: EventRecord): DispatchError {
  return dispatchError as DispatchError;
}

function getDispatchInfo({
  event: { data, method },
}: EventRecord): DispatchInfo {
  return method === "ExtrinsicSuccess"
    ? (data[0] as DispatchInfo)
    : (data[1] as DispatchInfo);
}

export function extractError(
  events: EventRecord[] = []
): DispatchError | undefined {
  return filterAndApply(
    events,
    "system",
    ["ExtrinsicFailed"],
    getDispatchError
  )[0];
}

export function isExtrinsicSuccessful(events: EventRecord[] = []): boolean {
  return (
    filterAndApply(events, "system", ["ExtrinsicSuccess"], () => true).length >
    0
  );
}

export function extractInfo(
  events: EventRecord[] = []
): DispatchInfo | undefined {
  return filterAndApply(
    events,
    "system",
    ["ExtrinsicFailed", "ExtrinsicSuccess"],
    getDispatchInfo
  )[0];
}

// Ethers
export const alithSigner = (context: ethers.Provider) => {
  const signer = new ethers.Wallet(ALITH_PRIVATE_KEY, context);
  signer.connect(context);
  return signer;
};
