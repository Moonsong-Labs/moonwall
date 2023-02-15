import { ApiPromise } from "@polkadot/api";
import { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types";
import { GenericExtrinsic } from "@polkadot/types/extrinsic";
import { DispatchError, DispatchInfo, EventRecord } from "@polkadot/types/interfaces";
import { AnyTuple, RegistryError } from "@polkadot/types/types";
import Web3 from "web3";
import { ethers } from "ethers";
export declare function resetToGenesis(api: ApiPromise): Promise<void>;
export declare function createBlock<ApiType extends ApiTypes, Call extends SubmittableExtrinsic<ApiType> | Promise<SubmittableExtrinsic<ApiType>> | string | Promise<string>, Calls extends Call | Call[]>(w3Api: Web3, pjsApi: ApiPromise, transactions?: Calls, options?: BlockCreation): Promise<BlockCreationResponse<ApiType, Calls extends Call[] ? Awaited<Call>[] : Awaited<Call>>>;
export interface BlockCreation {
    parentHash?: string;
    finalize?: boolean;
}
export interface BlockCreationResponse<ApiType extends ApiTypes, Call extends SubmittableExtrinsic<ApiType> | string | (SubmittableExtrinsic<ApiType> | string)[]> {
    block: {
        duration: number;
        hash: string;
    };
    result: Call extends (string | SubmittableExtrinsic<ApiType>)[] ? ExtrinsicCreation[] : ExtrinsicCreation;
}
export interface ExtrinsicCreation {
    extrinsic: GenericExtrinsic<AnyTuple>;
    events: EventRecord[];
    error: RegistryError;
    successful: boolean;
    hash: string;
}
export declare function filterAndApply<T>(events: EventRecord[], section: string, methods: string[], onFound: (record: EventRecord) => T): T[];
export declare function getDispatchError({ event: { data: [dispatchError], }, }: EventRecord): DispatchError;
export declare function extractError(events?: EventRecord[]): DispatchError | undefined;
export declare function isExtrinsicSuccessful(events?: EventRecord[]): boolean;
export declare function extractInfo(events?: EventRecord[]): DispatchInfo | undefined;
export declare const alithSigner: (context: ethers.Provider) => ethers.Wallet;
