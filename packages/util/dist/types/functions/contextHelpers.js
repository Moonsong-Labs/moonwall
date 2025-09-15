import "@moonbeam-network/api-augment";
// export interface ExtrinsicCreation {
//   extrinsic: GenericExtrinsic<AnyTuple>;
//   events: EventRecord[];
//   error: RegistryError;
//   successful: boolean;
//   hash: string;
// }
export function filterAndApply(events, section, methods, onFound) {
  return events
    .filter(({ event }) => section === event.section && methods.includes(event.method))
    .map((record) => onFound(record));
}
export function getDispatchError({
  event: {
    data: [dispatchError],
  },
}) {
  return dispatchError;
}
function getDispatchInfo({ event: { data, method } }) {
  return method === "ExtrinsicSuccess" ? data[0] : data[1];
}
export function extractError(events = []) {
  return filterAndApply(events, "system", ["ExtrinsicFailed"], getDispatchError)[0];
}
// export function extractFees(events: EventRecord[] = []): number {
//   return filterAndApply(events, "balances", ["Transfer"], () => true).length;
// }
export function isExtrinsicSuccessful(events = []) {
  return filterAndApply(events, "system", ["ExtrinsicSuccess"], () => true).length > 0;
}
export function extractInfo(events = []) {
  return filterAndApply(
    events,
    "system",
    ["ExtrinsicFailed", "ExtrinsicSuccess"],
    getDispatchInfo
  )[0];
}
export function extractFee(events = []) {
  return filterAndApply(events, "balances", ["Withdraw"], ({ event }) => event.data)[0];
}
//# sourceMappingURL=contextHelpers.js.map
