import "@moonbeam-network/api-augment";
import type { ApiPromise } from "@polkadot/api";
import type { TxWithEvent } from "@polkadot/api-derive/types";
import type { Option, u32, u64 } from "@polkadot/types";
import type { ITuple } from "@polkadot/types-codec/types";
import type {
  BlockHash,
  Event,
  Extrinsic,
  RuntimeDispatchInfo,
  RuntimeDispatchInfoV1,
} from "@polkadot/types/interfaces";
import type { Block, SignedBlock } from "@polkadot/types/interfaces/runtime/types";
import type { FrameSystemEventRecord, SpWeightsWeightV2Weight } from "@polkadot/types/lookup";
import Bottleneck from "bottleneck";
export declare function createAndFinalizeBlock(
  api: ApiPromise,
  parentHash?: string,
  finalize?: boolean
): Promise<{
  duration: number;
  hash: string;
  proofSize?: number;
}>;
export declare function calculateFeePortions(amount: bigint): {
  burnt: bigint;
  treasury: bigint;
};
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
export declare const getBlockExtrinsic: (
  api: ApiPromise,
  blockHash: string | BlockHash,
  section: string,
  method: string
) => Promise<{
  block: SignedBlock | any;
  extrinsic: Extrinsic | null | any;
  events: Event[];
  resultEvent: Event | undefined;
}>;
export declare const getBlockTime: (signedBlock: any) => any;
export declare const checkBlockFinalized: (
  api: ApiPromise,
  number: number
) => Promise<{
  number: number;
  finalized: any;
}>;
export declare const fetchHistoricBlockNum: (
  api: ApiPromise,
  blockNumber: number,
  targetTime: number
) => any;
export declare const getBlockArray: (
  api: ApiPromise,
  timePeriod: number,
  bottleneck?: Bottleneck
) => Promise<number[]>;
export declare function extractWeight(
  weightV1OrV2: u64 | Option<u64> | SpWeightsWeightV2Weight | Option<any>
): any;
export declare function extractPreimageDeposit(
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
):
  | {
      accountId: any;
      amount: any;
    }
  | undefined;
export declare function mapExtrinsics(
  extrinsics: Extrinsic[],
  records: FrameSystemEventRecord[],
  fees?: RuntimeDispatchInfo[] | RuntimeDispatchInfoV1[]
): TxWithEventAndFee[];
export declare function checkTimeSliceForUpgrades(
  api: ApiPromise,
  blockNumbers: number[],
  currentVersion: u32
): Promise<{
  result: boolean;
  specVersion: import("@polkadot/types-codec").Compact<u32>;
}>;
