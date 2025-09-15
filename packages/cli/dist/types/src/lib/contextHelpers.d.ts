import "@moonbeam-network/api-augment";
import type { DispatchError, DispatchInfo, EventRecord } from "@polkadot/types/interfaces";
export declare function filterAndApply<T>(
  events: EventRecord[],
  section: string,
  methods: string[],
  onFound: (record: EventRecord) => T
): T[];
export declare function getDispatchError({
  event: {
    data: [dispatchError],
  },
}: EventRecord): DispatchError;
export declare function extractError(events?: EventRecord[]): DispatchError | undefined;
export declare function isExtrinsicSuccessful(events?: EventRecord[]): boolean;
export declare function extractInfo(events?: EventRecord[]): DispatchInfo | undefined;
