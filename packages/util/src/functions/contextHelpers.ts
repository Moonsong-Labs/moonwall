import "@moonbeam-network/api-augment";
import "@polkadot/api-augment"
import { ApiTypes, SubmittableExtrinsic } from "@polkadot/api/types";
import { GenericExtrinsic } from "@polkadot/types/extrinsic";
import { DispatchError, DispatchInfo, EventRecord } from "@polkadot/types/interfaces";
import { AnyTuple, RegistryError } from "@polkadot/types/types";
import { ALITH_PRIVATE_KEY } from "../constants/accounts.js";
import { ethers } from "ethers";

export interface BlockCreation {
  parentHash?: string;
  finalize?: boolean;
}

export interface BlockCreationResponse<
  ApiType extends ApiTypes,
  Call extends SubmittableExtrinsic<ApiType> | string | (SubmittableExtrinsic<ApiType> | string)[]
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

export function filterAndApply<T>(
  events: EventRecord[],
  section: string,
  methods: string[],
  onFound: (record: EventRecord) => T
): T[] {
  return events
    .filter(({ event }) => section === event.section && methods.includes(event.method))
    .map((record) => onFound(record));
}

export function getDispatchError({
  event: {
    data: [dispatchError],
  },
}: EventRecord): DispatchError {
  return dispatchError as DispatchError;
}

function getDispatchInfo({ event: { data, method } }: EventRecord): DispatchInfo {
  return method === "ExtrinsicSuccess" ? (data[0] as DispatchInfo) : (data[1] as DispatchInfo);
}

export function extractError(events: EventRecord[] = []): DispatchError | undefined {
  return filterAndApply(events, "system", ["ExtrinsicFailed"], getDispatchError)[0];
}

export function isExtrinsicSuccessful(events: EventRecord[] = []): boolean {
  return filterAndApply(events, "system", ["ExtrinsicSuccess"], () => true).length > 0;
}

export function extractInfo(events: EventRecord[] = []): DispatchInfo | undefined {
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
