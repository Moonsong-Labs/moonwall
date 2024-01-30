import { ApiPromise } from "@polkadot/api";
import type { TxWithEvent } from "@polkadot/api-derive/types";
import { Option, u32, u64 } from "@polkadot/types";
import type { ITuple } from "@polkadot/types-codec/types";
import {
  BlockHash,
  DispatchError,
  DispatchInfo,
  Event,
  Extrinsic,
  RuntimeDispatchInfo,
  RuntimeDispatchInfoV1,
} from "@polkadot/types/interfaces";
import type { Block, SignedBlock } from "@polkadot/types/interfaces/runtime/types";
import { FrameSystemEventRecord, SpWeightsWeightV2Weight } from "@polkadot/types/lookup";
import Bottleneck from "bottleneck";
import Debug from "debug";
const debug = Debug("test:blocks");

export async function createAndFinalizeBlock(
  api: ApiPromise,
  parentHash?: string,
  finalize = false
): Promise<{
  duration: number;
  hash: string;
  proofSize?: number;
}> {
  const startTime: number = Date.now();
  // TODO: any/raw rpc request can be removed once api-augment is updated
  const block: any = parentHash
    ? await api.rpc("engine_createBlock", true, finalize, parentHash)
    : await api.rpc("engine_createBlock", true, finalize);

  return {
    duration: Date.now() - startTime,
    hash: block.hash as string, // toString doesn't work for block hashes
    proofSize: block.proof_size as number, // TODO: casting can be removed once api-augment is updated
  };
}

// Given a deposit amount, returns the amount burned (80%) and deposited to treasury (20%).
// This is meant to precisely mimic the logic in the Moonbeam runtimes where the burn amount
// is calculated and the treasury is treated as the remainder. This precision is important to
// avoid off-by-one errors.
export function calculateFeePortions(amount: bigint): {
  burnt: bigint;
  treasury: bigint;
} {
  const burnt = (amount * 80n) / 100n; // 20% goes to treasury
  return { burnt, treasury: amount - burnt };
}

export interface TxWithEventAndFee extends TxWithEvent {
  fee: RuntimeDispatchInfo | RuntimeDispatchInfoV1 | undefined;
}

export interface BlockDetails {
  block: Block;
  txWithEvents: TxWithEventAndFee[];
}

export interface BlockRangeOption {
  from: number;
  to: number;
  concurrency?: number;
}

export const getBlockExtrinsic = async (
  api: ApiPromise,
  blockHash: string | BlockHash,
  section: string,
  method: string
): Promise<{
  block: SignedBlock | any;
  extrinsic: Extrinsic | null | any;
  events: Event[];
  resultEvent: Event | undefined;
}> => {
  const apiAt = await api.at(blockHash);
  const [{ block }, records] = await Promise.all([
    api.rpc.chain.getBlock(blockHash),
    apiAt.query.system.events(),
  ]);
  const extIndex = block.extrinsics.findIndex(
    (ext) => ext.method.section === section && ext.method.method === method
  );
  const extrinsic = extIndex > -1 ? block.extrinsics[extIndex] : null;
  const events = (records as any)
    .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extIndex))
    .map(({ event }) => event);
  const resultEvent = events.find(
    (event) =>
      event.section === "system" &&
      (event.method === "ExtrinsicSuccess" || event.method === "ExtrinsicFailed")
  );
  return { block, extrinsic, events, resultEvent };
};

export const getBlockTime = (signedBlock: any) =>
  signedBlock.block.extrinsics
    .find((item) => item.method.section === "timestamp")
    .method.args[0].toNumber();

export const checkBlockFinalized = async (api: ApiPromise, number: number) => {
  return {
    number,
    //@ts-expect-error - remove once pJs exposes this
    finalized: await api._rpcCore.provider.send("moon_isBlockFinalized", [
      await api.rpc.chain.getBlockHash(number),
    ]),
  };
};

const fetchBlockTime = async (api: ApiPromise, blockNum: number) => {
  const hash = await api.rpc.chain.getBlockHash(blockNum);
  const block = await api.rpc.chain.getBlock(hash);
  return getBlockTime(block);
};

export const fetchHistoricBlockNum = async (
  api: ApiPromise,
  blockNumber: number,
  targetTime: number
) => {
  if (blockNumber <= 1) {
    return 1;
  }
  const time = await fetchBlockTime(api, blockNumber);

  if (time <= targetTime) {
    return blockNumber;
  }

  return fetchHistoricBlockNum(
    api,
    blockNumber - Math.ceil((time - targetTime) / 30_000),
    targetTime
  );
};

export const getBlockArray = async (
  api: ApiPromise,
  timePeriod: number,
  bottleneck?: Bottleneck
) => {
  /**  
  @brief Returns an sequential array of block numbers from a given period of time in the past
  @param api Connected ApiPromise to perform queries on
  @param timePeriod Moment in the past to search until
  @param limiter Bottleneck rate limiter to throttle requests
  */

  let limiter = bottleneck;

  if (!limiter) {
    limiter = new Bottleneck({ maxConcurrent: 10, minTime: 100 });
  }
  const finalizedHead = await limiter.schedule(() => api.rpc.chain.getFinalizedHead());
  const signedBlock = await limiter.schedule(() => api.rpc.chain.getBlock(finalizedHead));

  const lastBlockNumber = signedBlock.block.header.number.toNumber();
  const lastBlockTime = getBlockTime(signedBlock);

  const firstBlockTime = lastBlockTime - timePeriod;
  debug(`Searching for the block at: ${new Date(firstBlockTime)}`);
  const firstBlockNumber = (await limiter.wrap(fetchHistoricBlockNum)(
    api,
    lastBlockNumber,
    firstBlockTime
  )) as number;
  const length = lastBlockNumber - firstBlockNumber;
  return Array.from({ length }, (_, i) => firstBlockNumber + i);
};

export function extractWeight(
  weightV1OrV2: u64 | Option<u64> | SpWeightsWeightV2Weight | Option<any>
) {
  if ("isSome" in weightV1OrV2) {
    const weight = weightV1OrV2.unwrap();
    if ("refTime" in weight) {
      return weight.refTime.unwrap();
    }
    return weight;
  }
  if ("refTime" in weightV1OrV2) {
    return weightV1OrV2.refTime.unwrap();
  }
  return weightV1OrV2;
}

export function extractPreimageDeposit(
  request:
    | Option<ITuple<any>>
    | {
        readonly deposit: ITuple<any>;
        readonly len: u32;
      }
    | {
        readonly deposit: Option<ITuple<any>>;
        readonly count: u32;
        readonly len: Option<u32>;
      }
) {
  const deposit = "deposit" in request ? request.deposit : request;
  if ("isSome" in deposit && deposit.isSome) {
    return {
      accountId: deposit.unwrap()[0].toHex(),
      amount: deposit.unwrap()[1],
    };
  }
  if ("isNone" in deposit && deposit.isNone) {
    return undefined;
  }
  return {
    accountId: deposit[0].toHex(),
    amount: deposit[1],
  };
}

export function mapExtrinsics(
  extrinsics: Extrinsic[],
  records: FrameSystemEventRecord[],
  fees?: RuntimeDispatchInfo[] | RuntimeDispatchInfoV1[]
): TxWithEventAndFee[] {
  return extrinsics.map((extrinsic, index): TxWithEventAndFee => {
    let dispatchError: DispatchError | undefined;
    let dispatchInfo: DispatchInfo | undefined;

    const events = records
      .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
      .map(({ event }) => {
        if (event.section === "system") {
          if (event.method === "ExtrinsicSuccess") {
            dispatchInfo = event.data[0] as DispatchInfo;
          } else if (event.method === "ExtrinsicFailed") {
            dispatchError = event.data[0] as DispatchError;
            dispatchInfo = event.data[1] as DispatchInfo;
          }
        }

        return event;
      });
    return {
      dispatchError,
      dispatchInfo,
      events,
      extrinsic,
      fee: fees ? fees[index] : undefined,
    };
  });
}

export async function checkTimeSliceForUpgrades(
  api: ApiPromise,
  blockNumbers: number[],
  currentVersion: u32
) {
  const apiAt = await api.at(await api.rpc.chain.getBlockHash(blockNumbers[0]));
  const onChainRt = (await apiAt.query.system.lastRuntimeUpgrade()).unwrap().specVersion;
  return { result: !onChainRt.eq(currentVersion), specVersion: onChainRt };
}
