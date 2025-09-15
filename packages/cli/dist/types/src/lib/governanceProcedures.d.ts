import "@moonbeam-network/api-augment";
import type { DevModeContext } from "@moonwall/types";
import type { ApiPromise } from "@polkadot/api";
import type { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types";
import type { KeyringPair } from "@polkadot/keyring/types";
export declare const COUNCIL_MEMBERS: KeyringPair[];
export declare const COUNCIL_THRESHOLD: number;
export declare const TECHNICAL_COMMITTEE_MEMBERS: KeyringPair[];
export declare const TECHNICAL_COMMITTEE_THRESHOLD: number;
export declare const OPEN_TECHNICAL_COMMITTEE_MEMBERS: KeyringPair[];
export declare const OPEN_TECHNICAL_COMMITTEE_THRESHOLD: number;
export declare const notePreimage: <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  proposal: Call,
  account?: KeyringPair
) => Promise<string>;
export declare const instantFastTrack: <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  proposal: string | Call,
  {
    votingPeriod,
    delayPeriod,
  }?: {
    votingPeriod: number;
    delayPeriod: number;
  }
) => Promise<string>;
export declare const whiteListTrackNoSend: <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  proposal: string | Call
) => Promise<{
  proposalHash: string;
  whitelistedHash: string;
}>;
export declare const whiteListedTrack: <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  proposal: string | Call
) => Promise<void>;
export declare const execOpenTechCommitteeProposal: <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  call: Call | string,
  voters?: KeyringPair[],
  threshold?: number
) => Promise<import("@moonwall/types").ExtrinsicCreation>;
export declare const execCouncilProposal: <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  polkadotCall: Call,
  index?: number,
  voters?: KeyringPair[],
  threshold?: number
) => Promise<
  | import("@moonwall/types").ExtrinsicCreation
  | import("@moonwall/types").BlockCreationResponse<
      ApiTypes,
      Promise<SubmittableExtrinsic<"promise", import("@polkadot/types/types").ISubmittableResult>>
    >
>;
export declare const proposeReferendaAndDeposit: <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  decisionDepositer: KeyringPair,
  proposal: string | Call,
  origin: any
) => Promise<[number, string]>;
export declare const dispatchAsGeneralAdmin: <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  call: string | Call
) => Promise<void>;
export declare const maximizeConvictionVotingOf: (
  context: DevModeContext,
  voters: KeyringPair[],
  refIndex: number
) => Promise<void>;
export declare const execTechnicalCommitteeProposal: <
  Call extends SubmittableExtrinsic<ApiType>,
  ApiType extends ApiTypes,
>(
  context: DevModeContext,
  polkadotCall: Call,
  voters?: KeyringPair[],
  threshold?: number
) => Promise<import("@moonwall/types").ExtrinsicCreation | undefined>;
export declare const executeOpenTechCommitteeProposal: (
  api: ApiPromise,
  encodedHash: string
) => Promise<void>;
export declare const executeProposalWithCouncil: (
  api: ApiPromise,
  encodedHash: string
) => Promise<void>;
export declare const cancelReferendaWithCouncil: (
  api: ApiPromise,
  refIndex: number
) => Promise<void>;
export declare const fastFowardToNextEvent: (context: DevModeContext) => Promise<void>;
