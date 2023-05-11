const originalWrite = process.stderr.write.bind(process.stderr);
const blockList = ["has multiple versions, ensure that there is only one installed"];

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
      return originalWrite(chunk, encodingOrCallback);
    } else {
      return originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
    }
  }

  if (callback) {
    callback();
  } else if (typeof encodingOrCallback === "function") {
    encodingOrCallback();
  }

  return true;
};
