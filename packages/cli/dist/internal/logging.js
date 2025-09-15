// src/internal/logging.ts
var originalWrite = process.stderr.write.bind(process.stderr);
var blockList = [
  "has multiple versions, ensure that there is only one installed",
  "Unable to map [u8; 32] to a lookup index",
];
process.stderr.write = (chunk, encodingOrCallback, callback) => {
  let shouldWrite = true;
  if (typeof chunk === "string") {
    shouldWrite = !blockList.some((phrase) => chunk.includes(phrase));
  }
  if (shouldWrite) {
    if (typeof encodingOrCallback === "function") {
      return originalWrite.call(process.stderr, chunk, void 0, encodingOrCallback);
    }
    return originalWrite.call(process.stderr, chunk, encodingOrCallback, callback);
  }
  const cb = typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
  if (cb) cb(null);
  return true;
};
function logging_default() {}
export { logging_default as default };
