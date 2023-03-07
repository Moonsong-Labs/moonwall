import { ApiPromise } from "@polkadot/api";
import { BlockHash, RuntimeDispatchInfo } from "@polkadot/types/interfaces";
import { SpWeightsWeightV2Weight } from "@polkadot/types/lookup";
import { u32, u64, u128, Option } from "@polkadot/types";
import type {
  Block,
  AccountId20,
} from "@polkadot/types/interfaces/runtime/types";
import type { TxWithEvent } from "@polkadot/api-derive/types";
import type { ITuple } from "@polkadot/types-codec/types";
import Bottleneck from "bottleneck";
import Debug from "debug";
const debug = Debug("test:blocks");
export async function createAndFinalizeBlock(
  api: ApiPromise,
  parentHash?: string,
  finalize: boolean = false
): Promise<{
  duration: number;
  hash: string;
}> {
  const startTime: number = Date.now();
  const block = parentHash
    ? await api.rpc.engine.createBlock(true, finalize, parentHash)
    : await api.rpc.engine.createBlock(true, finalize);

  return {
    duration: Date.now() - startTime,
    hash: block.toJSON().hash as string, // toString doesn't work for block hashes
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
  fee: RuntimeDispatchInfo;
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
) => {
  const apiAt = await api.at(blockHash);
  const [{ block }, records] = await Promise.all([
    api.rpc.chain.getBlock(blockHash),
    apiAt.query.system.events(),
  ]);
  const extIndex = block.extrinsics.findIndex(
    (ext) => ext.method.section == section && ext.method.method == method
  );
  const extrinsic = extIndex > -1 ? block.extrinsics[extIndex] : null;

  const events = records
    .filter(
      ({ phase }) =>
        phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extIndex)
    )
    .map(({ event }) => event);
  const resultEvent = events.find(
    (event) =>
      event.section === "system" &&
      (event.method === "ExtrinsicSuccess" ||
        event.method === "ExtrinsicFailed")
  );
  return { block, extrinsic, events, resultEvent };
};

export const getBlockTime = (signedBlock: any) =>
  signedBlock.block.extrinsics
    .find((item) => item.method.section == "timestamp")
    .method.args[0].toNumber();

export const checkBlockFinalized = async (api: ApiPromise, number: number) => {
  return {
    number,
    finalized: (
      await (api.rpc as any).moon.isBlockFinalized(
        await api.rpc.chain.getBlockHash(number)
      )
    ).isTrue,
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
  limiter?: Bottleneck
) => {
  /**  
  @brief Returns an sequential array of block numbers from a given period of time in the past
  @param api Connected ApiPromise to perform queries on
  @param timePeriod Moment in the past to search until
  @param limiter Bottleneck rate limiter to throttle requests
  */

  if (limiter == null) {
    limiter = new Bottleneck({ maxConcurrent: 10, minTime: 100 });
  }
  const finalizedHead = await limiter.schedule(() =>
    api.rpc.chain.getFinalizedHead()
  );
  const signedBlock = await limiter.schedule(() =>
    api.rpc.chain.getBlock(finalizedHead)
  );

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
  weightV1OrV2:
    | u64
    | Option<u64>
    | SpWeightsWeightV2Weight
    | Option<SpWeightsWeightV2Weight>
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
    | Option<ITuple<[AccountId20, u128]>>
    | {
        readonly deposit: ITuple<[AccountId20, u128]>;
        readonly len: u32;
      }
    | {
        readonly deposit: Option<ITuple<[AccountId20, u128]>>;
        readonly count: u32;
        readonly len: Option<u32>;
      }
) {
  const deposit = "deposit" in request ? request.deposit : request;
  if ("isSome" in deposit) {
    return {
      accountId: deposit.unwrap()[0].toHex(),
      amount: deposit.unwrap()[1],
    };
  }
  return {
    accountId: deposit[0].toHex(),
    amount: deposit[1],
  };
}
