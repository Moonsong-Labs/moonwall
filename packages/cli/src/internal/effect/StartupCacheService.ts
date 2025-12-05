import { Context, Effect, Layer } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createLogger } from "@moonwall/util";

const logger = createLogger({ name: "StartupCacheService" });

export class StartupCacheError extends Error {
  readonly _tag = "StartupCacheError";
  constructor(
    readonly cause: unknown,
    readonly operation: "hash" | "precompile" | "cache"
  ) {
    super(`Startup cache operation failed during ${operation}: ${cause}`);
  }
}

export interface StartupCacheConfig {
  readonly binPath: string;
  readonly chainArg?: string;
  readonly cacheDir: string;
  /** Generate raw chain spec for faster startup (eliminates genesis WASM compilation) */
  readonly generateRawChainSpec?: boolean;
  /** Whether the node is being launched in dev mode (--dev flag) */
  readonly isDevMode?: boolean;
}

export interface StartupCacheResult {
  readonly precompiledPath: string;
  readonly fromCache: boolean;
  /** Path to raw chain spec if generated */
  readonly rawChainSpecPath?: string;
}

export class StartupCacheService extends Context.Tag("StartupCacheService")<
  StartupCacheService,
  {
    readonly getCachedArtifacts: (
      config: StartupCacheConfig
    ) => Effect.Effect<StartupCacheResult, StartupCacheError>;
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

/**
 * Generate a raw chain spec for faster startup.
 * Raw chain specs skip the genesis WASM compilation, providing ~10x faster startup.
 */
const generateRawChainSpec = (
  binPath: string,
  chainName: string,
  outputPath: string
): Promise<string> =>
  new Promise((resolve, reject) => {
    // Use --dev flag if chain name is "dev" or "default" (which means --dev was used)
    const args =
      chainName === "dev" || chainName === "default"
        ? ["build-spec", "--dev", "--raw"]
        : ["build-spec", `--chain=${chainName}`, "--raw"];

    logger.debug(`Generating raw chain spec: ${binPath} ${args.join(" ")}`);
    const startTime = Date.now();

    const child = spawn(binPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0 && stdout.length > 0) {
        fs.promises
          .writeFile(outputPath, stdout, "utf-8")
          .then(() => {
            logger.debug(`Raw chain spec generated in ${Date.now() - startTime}ms: ${outputPath}`);
            resolve(outputPath);
          })
          .catch(reject);
      } else {
        reject(new Error(`build-spec failed (code ${code}): ${stderr}`));
      }
    });

    child.on("error", reject);
  });

const getCachedArtifacts = (
  config: StartupCacheConfig
): Effect.Effect<StartupCacheResult, StartupCacheError> =>
  Effect.gen(function* () {
    // Hash the binary
    const binaryHash = yield* Effect.tryPromise({
      try: () => hashFile(config.binPath),
      catch: (e) => new StartupCacheError(e, "hash"),
    });

    const shortHash = binaryHash.substring(0, 12);
    // Use "dev" for dev mode, otherwise extract from --chain arg
    const chainName = config.isDevMode
      ? "dev"
      : config.chainArg?.match(/--chain[=\s]?(\S+)/)?.[1] || "default";
    const binName = path.basename(config.binPath);
    const cacheSubDir = path.join(config.cacheDir, `${binName}-${chainName}-${shortHash}`);
    const hashPath = path.join(cacheSubDir, "binary.hash");
    const lockPath = path.join(config.cacheDir, `${binName}-${chainName}.lock`);

    yield* Effect.tryPromise({
      try: () => fs.promises.mkdir(cacheSubDir, { recursive: true }),
      catch: (e) => new StartupCacheError(e, "cache"),
    });

    const cached = yield* Effect.tryPromise({
      try: () => checkCache(cacheSubDir, hashPath, binaryHash),
      catch: (e) => new StartupCacheError(e, "cache"),
    });

    if (cached) {
      logger.debug(`Using cached precompiled WASM: ${cached}`);
      // Check if raw chain spec also exists
      const rawSpecPath = path.join(cacheSubDir, `${chainName}-raw.json`);
      let rawChainSpecPath: string | undefined;
      if (config.generateRawChainSpec) {
        try {
          fs.accessSync(rawSpecPath, fs.constants.R_OK);
          rawChainSpecPath = rawSpecPath;
          logger.debug(`Using cached raw chain spec: ${rawSpecPath}`);
        } catch {
          // Raw spec doesn't exist, generate it
          try {
            rawChainSpecPath = yield* Effect.tryPromise({
              try: () => generateRawChainSpec(config.binPath, chainName, rawSpecPath),
              catch: (e) => new StartupCacheError(e, "cache"),
            });
          } catch (e) {
            logger.warn(`Failed to generate raw chain spec (non-fatal): ${e}`);
          }
        }
      }
      return { precompiledPath: cached, fromCache: true, rawChainSpecPath };
    }

    const releaseLock = yield* Effect.tryPromise({
      try: () => acquireLock(lockPath),
      catch: (e) => new StartupCacheError(e, "cache"),
    });

    try {
      const nowCached = yield* Effect.tryPromise({
        try: () => checkCache(cacheSubDir, hashPath, binaryHash),
        catch: (e) => new StartupCacheError(e, "cache"),
      });

      if (nowCached) {
        logger.debug(`Using cached precompiled WASM: ${nowCached}`);
        // Check if raw chain spec also exists (another process may have created it)
        const rawSpecPath = path.join(cacheSubDir, `${chainName}-raw.json`);
        let rawChainSpecPath: string | undefined;
        if (config.generateRawChainSpec) {
          try {
            fs.accessSync(rawSpecPath, fs.constants.R_OK);
            rawChainSpecPath = rawSpecPath;
            logger.debug(`Using cached raw chain spec: ${rawSpecPath}`);
          } catch {
            // Raw spec doesn't exist, generate it
            try {
              rawChainSpecPath = yield* Effect.tryPromise({
                try: () => generateRawChainSpec(config.binPath, chainName, rawSpecPath),
                catch: (e) => new StartupCacheError(e, "cache"),
              });
            } catch (e) {
              logger.warn(`Failed to generate raw chain spec (non-fatal): ${e}`);
            }
          }
        }
        return { precompiledPath: nowCached, fromCache: true, rawChainSpecPath };
      }

      logger.debug("Precompiling WASM (this may take a moment)...");
      const wasmPath = yield* Effect.tryPromise({
        try: () => runPrecompile(config.binPath, config.chainArg, cacheSubDir),
        catch: (e) => new StartupCacheError(e, "precompile"),
      });

      yield* Effect.tryPromise({
        try: () => fs.promises.writeFile(hashPath, binaryHash, "utf-8"),
        catch: (e) => new StartupCacheError(e, "cache"),
      });

      logger.debug(`Precompiled WASM created: ${wasmPath}`);

      // Generate raw chain spec for faster startup if requested
      let rawChainSpecPath: string | undefined;
      if (config.generateRawChainSpec) {
        const rawSpecPath = path.join(cacheSubDir, `${chainName}-raw.json`);
        try {
          rawChainSpecPath = yield* Effect.tryPromise({
            try: () => generateRawChainSpec(config.binPath, chainName, rawSpecPath),
            catch: (e) => new StartupCacheError(e, "cache"),
          });
        } catch (e) {
          logger.warn(`Failed to generate raw chain spec (non-fatal): ${e}`);
        }
      }

      return { precompiledPath: wasmPath, fromCache: false, rawChainSpecPath };
    } finally {
      releaseLock();
    }
  });

export const StartupCacheServiceLive = Layer.succeed(StartupCacheService, {
  getCachedArtifacts,
});
