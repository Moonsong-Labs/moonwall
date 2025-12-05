import { Command, type CommandExecutor, FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import type { PlatformError } from "@effect/platform/Error";
import { createLogger } from "@moonwall/util";
import { Context, Effect, Layer, Option, Stream } from "effect";
import * as crypto from "node:crypto";
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
// Platform service type alias for cleaner signatures
// =============================================================================

type PlatformR = FileSystem.FileSystem | Path.Path;
type PlatformCommandR = PlatformR | CommandExecutor.CommandExecutor;

// =============================================================================
// Effect-based helper functions using platform services
// =============================================================================

/**
 * Hash a file using SHA256 streaming via FileSystem.stream()
 * Note: node:crypto is the only Node builtin we keep (no Effect equivalent)
 */
const hashFile = (
  filePath: string
): Effect.Effect<string, StartupCacheError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const hash = crypto.createHash("sha256");

    yield* fs
      .stream(filePath)
      .pipe(Stream.runForEach((chunk) => Effect.sync(() => hash.update(chunk))));

    return hash.digest("hex");
  }).pipe(
    Effect.mapError((cause) => new StartupCacheError({ cause, operation: "hash" })),
    Effect.withSpan("StartupCache.hashFile")
  );

/**
 * Find precompiled WASM file in a directory
 */
const findPrecompiledWasm = (dir: string): Effect.Effect<Option.Option<string>, never, PlatformR> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const exists = yield* fs.exists(dir);
    if (!exists) return Option.none<string>();

    const files = yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(() => []));

    const wasmFile = files.find(
      (f) => f.startsWith("precompiled_wasm_") || f.endsWith(".cwasm") || f.endsWith(".wasm")
    );

    return wasmFile ? Option.some(pathService.join(dir, wasmFile)) : Option.none<string>();
  }).pipe(
    Effect.catchAll(() => Effect.succeed(Option.none<string>())),
    Effect.withSpan("StartupCache.findPrecompiledWasm")
  );

/**
 * Check if cached artifacts exist and are valid
 */
const checkCache = (
  cacheDir: string,
  hashPath: string,
  expectedHash: string
): Effect.Effect<Option.Option<string>, never, PlatformR> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    // Read saved hash
    const savedHash = yield* fs.readFileString(hashPath).pipe(Effect.orElseSucceed(() => ""));

    if (savedHash.trim() !== expectedHash) {
      return Option.none<string>();
    }

    // Check if WASM file exists
    const wasmPath = yield* findPrecompiledWasm(cacheDir);
    if (Option.isNone(wasmPath)) {
      return Option.none<string>();
    }

    // Verify file is accessible
    const accessible = yield* fs.access(wasmPath.value).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    );

    return accessible ? wasmPath : Option.none<string>();
  }).pipe(Effect.withSpan("StartupCache.checkCache"));

/**
 * Acquire a cross-process lock using directory creation (atomic on all platforms)
 * This replaces the O_EXCL file-based lock with a more portable approach
 */
const acquireLock = (
  lockPath: string,
  timeout = 120000
): Effect.Effect<void, StartupCacheError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const startTime = Date.now();

    // Retry loop to acquire lock
    while (Date.now() - startTime < timeout) {
      // Try to create lock directory (atomic operation)
      const acquired = yield* fs.makeDirectory(lockPath).pipe(
        Effect.as(true),
        Effect.catchAll(() => Effect.succeed(false))
      );

      if (acquired) {
        logger.debug(`Acquired lock: ${lockPath}`);
        return;
      }

      // Wait and retry
      yield* Effect.sleep("500 millis");
    }

    yield* Effect.fail(new StartupCacheError({ cause: "Lock timeout", operation: "lock" }));
  }).pipe(Effect.withSpan("StartupCache.acquireLock"));

/**
 * Release lock by removing directory
 */
const releaseLock = (lockPath: string): Effect.Effect<void, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(lockPath).pipe(Effect.ignore);
  });

/**
 * Scoped lock resource using acquireRelease pattern
 */
const withLock = (lockPath: string) =>
  Effect.acquireRelease(acquireLock(lockPath), () => releaseLock(lockPath));

/**
 * Run the precompile-wasm command using Effect Command
 */
const runPrecompile = (
  binPath: string,
  chainArg: string | undefined,
  outputDir: string
): Effect.Effect<string, StartupCacheError, PlatformCommandR> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const args = chainArg
      ? ["precompile-wasm", chainArg, outputDir]
      : ["precompile-wasm", outputDir];

    logger.debug(`Precompiling: ${binPath} ${args.join(" ")}`);
    const startTime = Date.now();

    const command = Command.make(binPath, ...args);

    // Run command - exitCode will throw on spawn error
    const exitCode = yield* Command.exitCode(command).pipe(
      Effect.mapError(
        (e: PlatformError) => new StartupCacheError({ cause: e, operation: "precompile" })
      )
    );

    // Find the generated WASM file
    const files = yield* fs
      .readDirectory(outputDir)
      .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "precompile" })));

    const wasmFile = files.find(
      (f) => f.startsWith("precompiled_wasm_") || f.endsWith(".cwasm") || f.endsWith(".wasm")
    );

    if (!wasmFile) {
      return yield* Effect.fail(
        new StartupCacheError({
          cause: `precompile-wasm failed (code ${exitCode}): no WASM file generated`,
          operation: "precompile",
        })
      );
    }

    const wasmPath = pathService.join(outputDir, wasmFile);
    logger.debug(`Precompiled in ${Date.now() - startTime}ms: ${wasmPath}`);

    return wasmPath;
  }).pipe(Effect.withSpan("StartupCache.runPrecompile"));

/**
 * Generate a raw chain spec using Effect Command
 */
const generateRawChainSpec = (
  binPath: string,
  chainName: string,
  outputPath: string
): Effect.Effect<string, StartupCacheError, PlatformCommandR> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const args =
      chainName === "dev" || chainName === "default"
        ? ["build-spec", "--dev", "--raw"]
        : ["build-spec", `--chain=${chainName}`, "--raw"];

    logger.debug(`Generating raw chain spec: ${binPath} ${args.join(" ")}`);
    const startTime = Date.now();

    const command = Command.make(binPath, ...args);

    // Run command and capture stdout
    const stdout = yield* Command.string(command).pipe(
      Effect.mapError(
        (e: PlatformError) => new StartupCacheError({ cause: e, operation: "chainspec" })
      )
    );

    if (stdout.length === 0) {
      return yield* Effect.fail(
        new StartupCacheError({ cause: "build-spec produced no output", operation: "chainspec" })
      );
    }

    // Write output to file
    yield* fs
      .writeFileString(outputPath, stdout)
      .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "chainspec" })));

    logger.debug(`Raw chain spec generated in ${Date.now() - startTime}ms: ${outputPath}`);
    return outputPath;
  }).pipe(Effect.withSpan("StartupCache.generateRawChainSpec"));

/**
 * Try to get or generate a raw chain spec (non-fatal on failure)
 */
const maybeGetRawChainSpec = (
  binPath: string,
  chainName: string,
  cacheSubDir: string,
  shouldGenerate: boolean
): Effect.Effect<Option.Option<string>, never, PlatformCommandR> =>
  Effect.gen(function* () {
    if (!shouldGenerate) {
      return Option.none<string>();
    }

    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const rawSpecPath = pathService.join(cacheSubDir, `${chainName}-raw.json`);

    // Check if it already exists (catch errors - treat as non-existent)
    const exists = yield* fs.exists(rawSpecPath).pipe(Effect.orElseSucceed(() => false));
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

const getCachedArtifactsImpl = (
  config: StartupCacheConfig
): Effect.Effect<StartupCacheResult, StartupCacheError, PlatformCommandR> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    // Hash the binary
    const binaryHash = yield* hashFile(config.binPath);

    const shortHash = binaryHash.substring(0, 12);
    const chainName = config.isDevMode
      ? "dev"
      : config.chainArg?.match(/--chain[=\s]?(\S+)/)?.[1] || "default";
    const binName = pathService.basename(config.binPath);
    const cacheSubDir = pathService.join(config.cacheDir, `${binName}-${chainName}-${shortHash}`);
    const hashPath = pathService.join(cacheSubDir, "binary.hash");
    const lockPath = pathService.join(config.cacheDir, `${binName}-${chainName}.lock`);

    // Ensure cache directory exists
    yield* fs
      .makeDirectory(cacheSubDir, { recursive: true })
      .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "cache" })));

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
          yield* fs
            .writeFileString(hashPath, binaryHash)
            .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "cache" })));

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
  }).pipe(Effect.withSpan("StartupCacheService.getCachedArtifacts"));

// =============================================================================
// Service Layer - provides platform dependencies internally
// =============================================================================

/**
 * Live implementation that provides all platform dependencies via NodeContext.layer
 */
export const StartupCacheServiceLive = Layer.succeed(StartupCacheService, {
  getCachedArtifacts: (config) =>
    getCachedArtifactsImpl(config).pipe(Effect.provide(NodeContext.layer)),
});

/**
 * Layer that exposes platform requirements - useful for testing with mocked FileSystem
 * Usage: Effect.provide(StartupCacheServiceTestable).pipe(Effect.provide(FileSystem.layerNoop(...)))
 */
export const StartupCacheServiceTestable = Layer.succeed(StartupCacheService, {
  getCachedArtifacts: getCachedArtifactsImpl as (
    config: StartupCacheConfig
  ) => Effect.Effect<StartupCacheResult, StartupCacheError>,
});
