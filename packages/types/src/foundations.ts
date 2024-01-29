import { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types";
import { ExtrinsicCreation } from "./context";

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
