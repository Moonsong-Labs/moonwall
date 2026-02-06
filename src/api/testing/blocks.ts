import type { ApiPromise } from "@polkadot/api";
import type { TxWithEvent } from "@polkadot/api-derive/types";
import type { Option, u32, u64 } from "@polkadot/types";
import type { Codec, ITuple } from "@polkadot/types-codec/types";
import type {
  BlockHash,
  DispatchError,
  DispatchInfo,
  Event,
  EventRecord,
  Extrinsic,
  RuntimeDispatchInfo,
  RuntimeDispatchInfoV1,
} from "@polkadot/types/interfaces";
import type { Block, SignedBlock } from "@polkadot/types/interfaces/runtime/types";
import Bottleneck from "bottleneck";
import { createLogger } from "../../internal/logger.js";
import type { ExtrinsicCreation } from "../types/index.js";
const logger = createLogger({ name: "test:blocks" });
const debug = logger.debug.bind(logger);

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
  const events = (records as unknown as EventRecord[])
    .filter(
      ({ phase }: EventRecord) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extIndex)
    )
    .map(({ event }: EventRecord) => event);
  const resultEvent = events.find(
    (event: Event) =>
      event.section === "system" &&
      (event.method === "ExtrinsicSuccess" || event.method === "ExtrinsicFailed")
  );
  return { block, extrinsic, events, resultEvent };
};

export const getBlockTime = (signedBlock: SignedBlock) =>
  (
    signedBlock.block.extrinsics.find((item: Extrinsic) => item.method.section === "timestamp")!
      .method.args[0] as unknown as { toNumber(): number }
  ).toNumber();

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
): Promise<number> => {
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
  const signedBlock: SignedBlock = await limiter.schedule(() =>
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

export function extractWeight(weightV1OrV2: u64 | Option<u64> | Codec | Option<any>) {
  if ("isSome" in weightV1OrV2) {
    const weight = weightV1OrV2.unwrap();
    if ("refTime" in weight) {
      return (weight as any).refTime.unwrap();
    }
    return weight;
  }
  if ("refTime" in weightV1OrV2) {
    return (weightV1OrV2 as any).refTime.unwrap();
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
  records: EventRecord[],
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
  const onChainRt = ((await apiAt.query.system.lastRuntimeUpgrade()) as any).unwrap().specVersion;
  return { result: !onChainRt.eq(currentVersion), specVersion: onChainRt };
}

/**
 * Extracts a single ExtrinsicCreation from a block result.
 * Handles the case where result may be a single item or an array.
 * @param result - The block result which can be ExtrinsicCreation | ExtrinsicCreation[] | null
 * @param index - Optional index when result is an array (default: 0)
 * @returns The ExtrinsicCreation at the specified index
 * @throws Error if result is null or if the array is empty
 */
export function extractSingleResult(
  result: ExtrinsicCreation | ExtrinsicCreation[] | null | undefined,
  index = 0
): ExtrinsicCreation {
  if (!result) {
    throw new Error("Block result is null or undefined");
  }
  if (Array.isArray(result)) {
    if (result.length === 0) {
      throw new Error("Block result array is empty");
    }
    if (index >= result.length) {
      throw new Error(
        `Index ${index} out of bounds for block result array of length ${result.length}`
      );
    }
    return result[index];
  }
  return result;
}
