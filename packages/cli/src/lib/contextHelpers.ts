import "@moonbeam-network/api-augment";
import type { DispatchError, DispatchInfo, EventRecord } from "@polkadot/types/interfaces";

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
