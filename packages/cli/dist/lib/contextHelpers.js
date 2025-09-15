// src/lib/contextHelpers.ts
import "@moonbeam-network/api-augment";
function filterAndApply(events, section, methods, onFound) {
  return events
    .filter(({ event }) => section === event.section && methods.includes(event.method))
    .map((record) => onFound(record));
}
function getDispatchError({
  event: {
    data: [dispatchError],
  },
}) {
  return dispatchError;
}
function getDispatchInfo({ event: { data, method } }) {
  return method === "ExtrinsicSuccess" ? data[0] : data[1];
}
function extractError(events = []) {
  return filterAndApply(events, "system", ["ExtrinsicFailed"], getDispatchError)[0];
}
function isExtrinsicSuccessful(events = []) {
  return filterAndApply(events, "system", ["ExtrinsicSuccess"], () => true).length > 0;
}
function extractInfo(events = []) {
  return filterAndApply(
    events,
    "system",
    ["ExtrinsicFailed", "ExtrinsicSuccess"],
    getDispatchInfo
  )[0];
}
export { extractError, extractInfo, filterAndApply, getDispatchError, isExtrinsicSuccessful };
