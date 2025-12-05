import { Context, Effect, Layer } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createLogger } from "@moonwall/util";

const logger = createLogger({ name: "WasmPrecompileService" });

export class WasmPrecompileError extends Error {
  readonly _tag = "WasmPrecompileError";
  constructor(
    readonly cause: unknown,
    readonly operation: "hash" | "precompile" | "cache"
  ) {
    super(`WASM precompilation failed during ${operation}: ${cause}`);
  }
}

export interface WasmPrecompileConfig {
  readonly binPath: string;
  readonly chainArg?: string;
  readonly cacheDir: string;
}

export interface WasmPrecompileResult {
  readonly precompiledPath: string;
  readonly fromCache: boolean;
}

export class WasmPrecompileService extends Context.Tag("WasmPrecompileService")<
  WasmPrecompileService,
  {
    readonly getPrecompiledPath: (
      config: WasmPrecompileConfig
    ) => Effect.Effect<WasmPrecompileResult, WasmPrecompileError>;
  }
>() {}

const hashFile = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });

const findPrecompiledWasm = (dir: string): string | null => {
  try {
    const files = fs.readdirSync(dir);
    const wasmFile = files.find(
      (f) => f.startsWith("precompiled_wasm_") || f.endsWith(".cwasm") || f.endsWith(".wasm")
    );
    return wasmFile ? path.join(dir, wasmFile) : null;
  } catch {
    return null;
  }
};

const checkCache = async (
  cacheDir: string,
  hashPath: string,
  expectedHash: string
): Promise<string | null> => {
  try {
    const savedHash = await fs.promises.readFile(hashPath, "utf-8");
    if (savedHash.trim() !== expectedHash) return null;

    const wasmPath = findPrecompiledWasm(cacheDir);
    if (wasmPath) {
      await fs.promises.access(wasmPath, fs.constants.R_OK);
      return wasmPath;
    }
  } catch {
    // Cache miss
  }
  return null;
};

const acquireLock = async (lockPath: string, timeout = 120000): Promise<() => void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const fd = fs.openSync(
        lockPath,
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY
      );
      fs.writeSync(fd, `${process.pid}`);
      fs.closeSync(fd);
      logger.debug(`Acquired lock: ${lockPath}`);
      return () => {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          /* ignore */
        }
      };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Lock timeout: ${lockPath}`);
};

const runPrecompile = (
  binPath: string,
  chainArg: string | undefined,
  outputDir: string
): Promise<string> =>
  new Promise((resolve, reject) => {
    const args = ["precompile-wasm"];
    if (chainArg) args.push(chainArg);
    args.push(outputDir);

    logger.debug(`Precompiling: ${binPath} ${args.join(" ")}`);
    const startTime = Date.now();

    const child = spawn(binPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      const wasmPath = findPrecompiledWasm(outputDir);
      if (wasmPath) {
        logger.debug(`Precompiled in ${Date.now() - startTime}ms: ${wasmPath}`);
        resolve(wasmPath);
      } else {
        reject(new Error(`precompile-wasm failed (code ${code}): ${stderr}`));
      }
    });

    child.on("error", reject);
  });

const getPrecompiledPath = (
  config: WasmPrecompileConfig
): Effect.Effect<WasmPrecompileResult, WasmPrecompileError> =>
  Effect.gen(function* () {
    // Hash the binary
    const binaryHash = yield* Effect.tryPromise({
      try: () => hashFile(config.binPath),
      catch: (e) => new WasmPrecompileError(e, "hash"),
    });

    const shortHash = binaryHash.substring(0, 12);
    const chainName = config.chainArg?.match(/--chain[=\s]?(\S+)/)?.[1] || "default";
    const binName = path.basename(config.binPath);
    const cacheSubDir = path.join(config.cacheDir, `${binName}-${chainName}-${shortHash}`);
    const hashPath = path.join(cacheSubDir, "binary.hash");
    const lockPath = path.join(config.cacheDir, `${binName}-${chainName}.lock`);

    yield* Effect.tryPromise({
      try: () => fs.promises.mkdir(cacheSubDir, { recursive: true }),
      catch: (e) => new WasmPrecompileError(e, "cache"),
    });

    const cached = yield* Effect.tryPromise({
      try: () => checkCache(cacheSubDir, hashPath, binaryHash),
      catch: (e) => new WasmPrecompileError(e, "cache"),
    });

    if (cached) {
      logger.debug(`Using cached precompiled WASM: ${cached}`);
      return { precompiledPath: cached, fromCache: true };
    }

    const releaseLock = yield* Effect.tryPromise({
      try: () => acquireLock(lockPath),
      catch: (e) => new WasmPrecompileError(e, "cache"),
    });

    try {
      const nowCached = yield* Effect.tryPromise({
        try: () => checkCache(cacheSubDir, hashPath, binaryHash),
        catch: (e) => new WasmPrecompileError(e, "cache"),
      });

      if (nowCached) {
        logger.debug(`Using cached precompiled WASM: ${nowCached}`);
        return { precompiledPath: nowCached, fromCache: true };
      }

      logger.debug("Precompiling WASM (this may take a moment)...");
      const wasmPath = yield* Effect.tryPromise({
        try: () => runPrecompile(config.binPath, config.chainArg, cacheSubDir),
        catch: (e) => new WasmPrecompileError(e, "precompile"),
      });

      yield* Effect.tryPromise({
        try: () => fs.promises.writeFile(hashPath, binaryHash, "utf-8"),
        catch: (e) => new WasmPrecompileError(e, "cache"),
      });

      logger.debug(`Precompiled WASM created: ${wasmPath}`);
      return { precompiledPath: wasmPath, fromCache: false };
    } finally {
      releaseLock();
    }
  });

export const WasmPrecompileServiceLive = Layer.succeed(WasmPrecompileService, {
  getPrecompiledPath,
});
