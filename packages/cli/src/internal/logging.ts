import { LogLevel, Logger } from "effect";

const originalWrite = process.stderr.write.bind(process.stderr);
const blockList = [
  "has multiple versions, ensure that there is only one installed",
  "Unable to map [u8; 32] to a lookup index",
];

process.stderr.write = (
  chunk: string | Uint8Array,
  encodingOrCallback?: BufferEncoding | ((error?: Error | undefined) => void),
  callback?: (error?: Error | undefined) => void
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

// const ANSI = {
//   Reset: "\x1b[0m",
//   Bold: "\x1b[1m",
// };

// type LogLevels = "Info" | "Debug" | "Error" | "Warn" | "Fatal";

export const colors = {
  // eslint-disable-next-line no-control-regex
  uncolorize: (str: string) => str.replace(/\x1B\[\d+m/gi, ""),
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m", // bold
  italic: "\x1b[3m", // non-standard feature
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    crimson: "\x1b[38m",
  },

  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    crimson: "\x1b[48m",
  },
};

export const CustomLog = Logger.make(({ logLevel, message }) => {
  switch (logLevel._tag) {
    case "Info":
      globalThis.console.log(`${colors.fg.blue}[${logLevel.label}]${colors.reset} ${message}`);
      break;

    case "Debug":
      globalThis.console.log(`${colors.fg.magenta}[${logLevel.label}]${colors.reset} ${message}`);
      break;

    case "Error":
      globalThis.console.log(`${colors.fg.red}[${logLevel.label}]${colors.reset} ${message}`);
      break;

    case "Warning":
      globalThis.console.log(`${colors.fg.yellow}[${logLevel.label}]${colors.reset} ${message}`);
      break;

    case "Fatal":
      globalThis.console.log(`${colors.fg.red}[${logLevel.label}]${colors.reset} ${message}`);
      break;
  }
});

export const debuglogLevel = Logger.minimumLogLevel(LogLevel.Debug);
export const logLevel = Logger.replace(Logger.defaultLogger, CustomLog);
