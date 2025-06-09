const originalWrite: typeof process.stderr.write = process.stderr.write.bind(process.stderr);

const blockList: readonly string[] = [
  "has multiple versions, ensure that there is only one installed",
  "Unable to map [u8; 32] to a lookup index",
];

process.stderr.write = (
  chunk: string | Uint8Array,
  encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
  callback?: (error?: Error | null) => void
): boolean => {
  let shouldWrite = true;
  if (typeof chunk === "string") {
    shouldWrite = !blockList.some((phrase) => chunk.includes(phrase));
  }

  if (shouldWrite) {
    if (typeof encodingOrCallback === "function") {
      // Second argument must always be BufferEncoding or undefined.
      // When encodingOrCallback is a function, pass as cb; encoding is undefined.
      return originalWrite.call(process.stderr, chunk, undefined, encodingOrCallback);
    }
    return originalWrite.call(process.stderr, chunk, encodingOrCallback, callback);
  }

  // Suppress output but invoke callback if present
  const cb = typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
  if (cb) cb(null);
  return true;
};

export default function () {}
