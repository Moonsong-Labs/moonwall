import "@moonbeam-network/api-augment";
import type { BlockCreation, ExtrinsicCreation, GenericContext } from "@moonwall/types";
import type { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types";
export declare function getDevProviderPath(): Promise<string>;
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
export declare function createDevBlock<
  ApiType extends ApiTypes,
  Calls extends CallType<ApiType> | Array<CallType<ApiType>>,
>(
  context: GenericContext,
  options: BlockCreation,
  transactions?: Calls
): Promise<
  | {
      block: {
        duration: number;
        hash: string;
        proofSize?: number;
      };
      result?: undefined;
    }
  | {
      block: {
        duration: number;
        hash: string;
        proofSize?: number;
      };
      result: any;
    }
>;
