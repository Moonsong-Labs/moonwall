import { Context, Effect, Layer, Option } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createLogger } from "@moonwall/util";
import { StartupCacheError } from "./errors.js";

const logger = createLogger({ name: "StartupCacheService" });

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

// =============================================================================
// Effect-based helper functions with tracing
// =============================================================================

/**
 * Hash a file using SHA256 streaming
 */
const hashFile = Effect.fn("StartupCache.hashFile")(function* (filePath: string) {
  return yield* Effect.async<string, StartupCacheError>((resume) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resume(Effect.succeed(hash.digest("hex"))));
    stream.on("error", (err) =>
      resume(Effect.fail(new StartupCacheError({ cause: err, operation: "hash" })))
    );
  });
});

/**
 * Find precompiled WASM file in a directory
 */
const findPrecompiledWasm = (dir: string): Effect.Effect<Option.Option<string>, never> =>
  Effect.sync(() => {
    try {
      const files = fs.readdirSync(dir);
      const wasmFile = files.find(
        (f) => f.startsWith("precompiled_wasm_") || f.endsWith(".cwasm") || f.endsWith(".wasm")
      );
      return wasmFile ? Option.some(path.join(dir, wasmFile)) : Option.none<string>();
    } catch {
      return Option.none<string>();
    }
  }).pipe(Effect.withSpan("StartupCache.findPrecompiledWasm"));

/**
 * Check if cached artifacts exist and are valid
 */
const checkCache = (
  cacheDir: string,
  hashPath: string,
  expectedHash: string
): Effect.Effect<Option.Option<string>, never> =>
  Effect.gen(function* () {
    // Try to read saved hash (returns null on any error)
    const savedHash = yield* Effect.tryPromise(() => fs.promises.readFile(hashPath, "utf-8")).pipe(
      Effect.orElseSucceed(() => null)
    );

    if (!savedHash || savedHash.trim() !== expectedHash) {
      return Option.none<string>();
    }

    // Check if WASM file exists
    const wasmPath = yield* findPrecompiledWasm(cacheDir);
    if (Option.isNone(wasmPath)) {
      return Option.none<string>();
    }

    // Verify file is readable (returns false on any error)
    const isReadable = yield* Effect.tryPromise(() =>
      fs.promises.access(wasmPath.value, fs.constants.R_OK).then(() => true)
    ).pipe(Effect.orElseSucceed(() => false));

    return isReadable ? wasmPath : Option.none<string>();
  }).pipe(Effect.withSpan("StartupCache.checkCache"));

/**
 * Acquire a file-based lock using O_EXCL for cross-process coordination
 */
const acquireLock = Effect.fn("StartupCache.acquireLock")(function* (
  lockPath: string,
  timeout = 120000
) {
  const startTime = Date.now();

  return yield* Effect.async<() => void, StartupCacheError>((resume) => {
    const tryAcquire = () => {
      if (Date.now() - startTime >= timeout) {
        resume(Effect.fail(new StartupCacheError({ cause: "Lock timeout", operation: "lock" })));
        return;
      }

      try {
        const fd = fs.openSync(
          lockPath,
          fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY
        );
        fs.writeSync(fd, `${process.pid}`);
        fs.closeSync(fd);
        logger.debug(`Acquired lock: ${lockPath}`);

        const release = () => {
          try {
            fs.unlinkSync(lockPath);
          } catch {
            /* ignore */
          }
        };
        resume(Effect.succeed(release));
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === "EEXIST") {
          setTimeout(tryAcquire, 500);
        } else {
          resume(Effect.fail(new StartupCacheError({ cause: err, operation: "lock" })));
        }
      }
    };

    tryAcquire();
  });
});

/**
 * Create a scoped lock resource using acquireRelease pattern
 */
const withLock = (lockPath: string) =>
  Effect.acquireRelease(acquireLock(lockPath), (release) => Effect.sync(() => release()));

/**
 * Run the precompile-wasm command
 */
const runPrecompile = Effect.fn("StartupCache.runPrecompile")(function* (
  binPath: string,
  chainArg: string | undefined,
  outputDir: string
) {
  return yield* Effect.async<string, StartupCacheError>((resume) => {
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
      const files = fs.readdirSync(outputDir);
      const wasmFile = files.find(
        (f) => f.startsWith("precompiled_wasm_") || f.endsWith(".cwasm") || f.endsWith(".wasm")
      );

      if (wasmFile) {
        const wasmPath = path.join(outputDir, wasmFile);
        logger.debug(`Precompiled in ${Date.now() - startTime}ms: ${wasmPath}`);
        resume(Effect.succeed(wasmPath));
      } else {
        resume(
          Effect.fail(
            new StartupCacheError({
              cause: `precompile-wasm failed (code ${code}): ${stderr}`,
              operation: "precompile",
            })
          )
        );
      }
    });

    child.on("error", (err) =>
      resume(Effect.fail(new StartupCacheError({ cause: err, operation: "precompile" })))
    );
  });
});

/**
 * Generate a raw chain spec for faster startup
 */
const generateRawChainSpec = Effect.fn("StartupCache.generateRawChainSpec")(function* (
  binPath: string,
  chainName: string,
  outputPath: string
) {
  return yield* Effect.async<string, StartupCacheError>((resume) => {
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
            resume(Effect.succeed(outputPath));
          })
          .catch((err) =>
            resume(Effect.fail(new StartupCacheError({ cause: err, operation: "chainspec" })))
          );
      } else {
        resume(
          Effect.fail(
            new StartupCacheError({
              cause: `build-spec failed (code ${code}): ${stderr}`,
              operation: "chainspec",
            })
          )
        );
      }
    });

    child.on("error", (err) =>
      resume(Effect.fail(new StartupCacheError({ cause: err, operation: "chainspec" })))
    );
  });
});

/**
 * Try to get or generate a raw chain spec (non-fatal on failure)
 */
const maybeGetRawChainSpec = (
  binPath: string,
  chainName: string,
  cacheSubDir: string,
  shouldGenerate: boolean
): Effect.Effect<Option.Option<string>, never> =>
  Effect.gen(function* () {
    if (!shouldGenerate) {
      return Option.none<string>();
    }

    const rawSpecPath = path.join(cacheSubDir, `${chainName}-raw.json`);

    // Check if it already exists (returns false on any error)
    const exists = yield* Effect.tryPromise(() =>
      fs.promises.access(rawSpecPath, fs.constants.R_OK).then(() => true)
    ).pipe(Effect.orElseSucceed(() => false));

    if (exists) {
      logger.debug(`Using cached raw chain spec: ${rawSpecPath}`);
      return Option.some(rawSpecPath);
    }

    // Try to generate (non-fatal)
    return yield* generateRawChainSpec(binPath, chainName, rawSpecPath).pipe(
      Effect.map(Option.some<string>),
      Effect.catchAll((e) => {
        logger.warn(`Failed to generate raw chain spec (non-fatal): ${e.cause}`);
        return Effect.succeed(Option.none<string>());
      })
    );
  }).pipe(Effect.withSpan("StartupCache.maybeGetRawChainSpec"));

// =============================================================================
// Main service implementation
// =============================================================================

const getCachedArtifacts = Effect.fn("StartupCacheService.getCachedArtifacts")(function* (
  config: StartupCacheConfig
) {
  // Hash the binary
  const binaryHash = yield* hashFile(config.binPath);

  const shortHash = binaryHash.substring(0, 12);
  const chainName = config.isDevMode
    ? "dev"
    : config.chainArg?.match(/--chain[=\s]?(\S+)/)?.[1] || "default";
  const binName = path.basename(config.binPath);
  const cacheSubDir = path.join(config.cacheDir, `${binName}-${chainName}-${shortHash}`);
  const hashPath = path.join(cacheSubDir, "binary.hash");
  const lockPath = path.join(config.cacheDir, `${binName}-${chainName}.lock`);

  // Ensure cache directory exists
  yield* Effect.tryPromise({
    try: () => fs.promises.mkdir(cacheSubDir, { recursive: true }),
    catch: (e) => new StartupCacheError({ cause: e, operation: "cache" }),
  });

  // Check if already cached (before acquiring lock)
  const cached = yield* checkCache(cacheSubDir, hashPath, binaryHash);

  if (Option.isSome(cached)) {
    logger.debug(`Using cached precompiled WASM: ${cached.value}`);
    const rawChainSpecPath = yield* maybeGetRawChainSpec(
      config.binPath,
      chainName,
      cacheSubDir,
      config.generateRawChainSpec ?? false
    );
    return {
      precompiledPath: cached.value,
      fromCache: true,
      rawChainSpecPath: Option.getOrUndefined(rawChainSpecPath),
    };
  }

  // Need to precompile - use scoped lock for guaranteed cleanup
  return yield* Effect.scoped(
    Effect.flatMap(withLock(lockPath), () =>
      Effect.gen(function* () {
        // Double-check after acquiring lock (another process may have created it)
        const nowCached = yield* checkCache(cacheSubDir, hashPath, binaryHash);

        if (Option.isSome(nowCached)) {
          logger.debug(
            `Using cached precompiled WASM (created by another process): ${nowCached.value}`
          );
          const rawChainSpecPath = yield* maybeGetRawChainSpec(
            config.binPath,
            chainName,
            cacheSubDir,
            config.generateRawChainSpec ?? false
          );
          return {
            precompiledPath: nowCached.value,
            fromCache: true,
            rawChainSpecPath: Option.getOrUndefined(rawChainSpecPath),
          };
        }

        // Actually precompile
        logger.debug("Precompiling WASM (this may take a moment)...");
        const wasmPath = yield* runPrecompile(config.binPath, config.chainArg, cacheSubDir);

        // Save hash for future cache hits
        yield* Effect.tryPromise({
          try: () => fs.promises.writeFile(hashPath, binaryHash, "utf-8"),
          catch: (e) => new StartupCacheError({ cause: e, operation: "cache" }),
        });

        logger.debug(`Precompiled WASM created: ${wasmPath}`);

        // Generate raw chain spec if requested
        const rawChainSpecPath = yield* maybeGetRawChainSpec(
          config.binPath,
          chainName,
          cacheSubDir,
          config.generateRawChainSpec ?? false
        );

        return {
          precompiledPath: wasmPath,
          fromCache: false,
          rawChainSpecPath: Option.getOrUndefined(rawChainSpecPath),
        };
      })
    )
  );
});

export const StartupCacheServiceLive = Layer.succeed(StartupCacheService, {
  getCachedArtifacts,
});
