import "@moonbeam-network/api-augment/moonbase";
import { ApiPromise } from "@polkadot/api";
import { BlockHash, RuntimeDispatchInfo } from "@polkadot/types/interfaces";
import { SpWeightsWeightV2Weight } from "@polkadot/types/lookup";
import { u32, u64, u128, Option } from "@polkadot/types";
import type { Block, AccountId20 } from "@polkadot/types/interfaces/runtime/types";
import type { TxWithEvent } from "@polkadot/api-derive/types";
import type { ITuple } from "@polkadot/types-codec/types";
import Bottleneck from "bottleneck";
export declare function createAndFinalizeBlock(api: ApiPromise, parentHash?: string, finalize?: boolean): Promise<{
    duration: number;
    hash: string;
}>;
export declare function calculateFeePortions(amount: bigint): {
    burnt: bigint;
    treasury: bigint;
};
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
export declare const getBlockExtrinsic: (api: ApiPromise, blockHash: string | BlockHash, section: string, method: string) => Promise<{
    block: Block;
    extrinsic: import("@polkadot/types").GenericExtrinsic<import("@polkadot/types-codec/types").AnyTuple>;
    events: import("@polkadot/types/interfaces").Event[];
    resultEvent: import("@polkadot/types/interfaces").Event;
}>;
export declare const getBlockTime: (signedBlock: any) => any;
export declare const checkBlockFinalized: (api: ApiPromise, number: number) => Promise<{
    number: number;
    finalized: boolean;
}>;
export declare const fetchHistoricBlockNum: (api: ApiPromise, blockNumber: number, targetTime: number) => any;
export declare const getBlockArray: (api: ApiPromise, timePeriod: number, limiter?: Bottleneck) => Promise<number[]>;
export declare function extractWeight(weightV1OrV2: u64 | Option<u64> | SpWeightsWeightV2Weight | Option<SpWeightsWeightV2Weight>): u64;
export declare function extractPreimageDeposit(request: Option<ITuple<[AccountId20, u128]>> | {
    readonly deposit: ITuple<[AccountId20, u128]>;
    readonly len: u32;
} | {
    readonly deposit: Option<ITuple<[AccountId20, u128]>>;
    readonly count: u32;
    readonly len: Option<u32>;
}): {
    accountId: `0x${string}`;
    amount: u128;
};
