import { Command, type CommandExecutor, FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import type { PlatformError } from "@effect/platform/Error";
import { createLogger } from "../../util/index.js";
import { Context, Duration, Effect, Layer, Option, Stream } from "effect";
import * as crypto from "node:crypto";
import { StartupCacheError, type FileLockError } from "../errors.js";
import { withFileLock } from "./FileLock.js";

const logger = createLogger({ name: "StartupCacheService" });

export interface StartupCacheConfig {
  readonly binPath: string;
  readonly chainArg?: string;
  readonly cacheDir: string;
  readonly generateRawChainSpec?: boolean;
  readonly isDevMode?: boolean;
}

export interface StartupCacheResult {
  readonly precompiledPath: string;
  readonly fromCache: boolean;
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

type PlatformR = FileSystem.FileSystem | Path.Path;
type PlatformCommandR = PlatformR | CommandExecutor.CommandExecutor;

// =============================================================================
// Helper functions
// =============================================================================

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
  }).pipe(Effect.mapError((cause) => new StartupCacheError({ cause, operation: "hash" })));

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
  }).pipe(Effect.catchAll(() => Effect.succeed(Option.none<string>())));

const checkCache = (
  cacheDir: string,
  hashPath: string,
  expectedHash: string
): Effect.Effect<Option.Option<string>, never, PlatformR> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const savedHash = yield* fs.readFileString(hashPath).pipe(Effect.orElseSucceed(() => ""));
    if (savedHash.trim() !== expectedHash) return Option.none<string>();
    const wasmPath = yield* findPrecompiledWasm(cacheDir);
    if (Option.isNone(wasmPath)) return Option.none<string>();
    const accessible = yield* fs.access(wasmPath.value).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    );
    return accessible ? wasmPath : Option.none<string>();
  });

// =============================================================================
// Precompilation commands
// =============================================================================

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

    const exitCode = yield* Command.exitCode(Command.make(binPath, ...args)).pipe(
      Effect.mapError(
        (e: PlatformError) => new StartupCacheError({ cause: e, operation: "precompile" })
      )
    );

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
  });

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
    const stdout = yield* Command.string(Command.make(binPath, ...args)).pipe(
      Effect.mapError(
        (e: PlatformError) => new StartupCacheError({ cause: e, operation: "chainspec" })
      )
    );

    if (!stdout.length) {
      return yield* Effect.fail(
        new StartupCacheError({ cause: "build-spec produced no output", operation: "chainspec" })
      );
    }

    yield* fs
      .writeFileString(outputPath, stdout)
      .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "chainspec" })));
    return outputPath;
  });

const maybeGetRawChainSpec = (
  binPath: string,
  chainName: string,
  cacheSubDir: string,
  shouldGenerate: boolean
): Effect.Effect<Option.Option<string>, never, PlatformCommandR> =>
  Effect.gen(function* () {
    if (!shouldGenerate) return Option.none<string>();

    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const rawSpecPath = pathService.join(cacheSubDir, `${chainName}-raw.json`);

    const exists = yield* fs.exists(rawSpecPath).pipe(Effect.orElseSucceed(() => false));
    if (exists) return Option.some(rawSpecPath);

    return yield* generateRawChainSpec(binPath, chainName, rawSpecPath).pipe(
      Effect.map(Option.some<string>),
      Effect.catchAll(() => Effect.succeed(Option.none<string>()))
    );
  });

// =============================================================================
// Main implementation
// =============================================================================

const getCachedArtifactsImpl = (
  config: StartupCacheConfig
): Effect.Effect<
  StartupCacheResult,
  StartupCacheError | FileLockError,
  PlatformCommandR | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const binaryHash = yield* hashFile(config.binPath);
    const shortHash = binaryHash.substring(0, 12);
    const chainName = config.isDevMode
      ? "dev"
      : config.chainArg?.match(/--chain[=\s]?(\S+)/)?.[1] || "default";
    const binName = pathService.basename(config.binPath);
    const cacheSubDir = pathService.join(config.cacheDir, `${binName}-${chainName}-${shortHash}`);
    const hashPath = pathService.join(cacheSubDir, "binary.hash");
    const lockPath = pathService.join(config.cacheDir, `${binName}-${chainName}.lock`);

    yield* fs
      .makeDirectory(cacheSubDir, { recursive: true })
      .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "cache" })));

    // Fast path: cache exists
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

    // Need to build - acquire lock using shared FileLock module
    return yield* withFileLock(
      lockPath,
      Effect.gen(function* () {
        // Double-check after acquiring lock
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

        // Build
        logger.debug("Precompiling WASM (this may take a moment)...");
        const wasmPath = yield* runPrecompile(config.binPath, config.chainArg, cacheSubDir);
        yield* fs
          .writeFileString(hashPath, binaryHash)
          .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "cache" })));

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
      }),
      Duration.minutes(2)
    );
  });

// =============================================================================
// Service Layer
// =============================================================================

export const StartupCacheServiceLive = Layer.succeed(StartupCacheService, {
  getCachedArtifacts: (config) =>
    getCachedArtifactsImpl(config).pipe(
      Effect.mapError((e) =>
        e._tag === "FileLockError" ? new StartupCacheError({ cause: e, operation: "lock" }) : e
      ),
      Effect.provide(NodeContext.layer)
    ),
});

export const StartupCacheServiceTestable = Layer.succeed(StartupCacheService, {
  getCachedArtifacts: (config) =>
    getCachedArtifactsImpl(config).pipe(
      Effect.mapError((e) =>
        e._tag === "FileLockError" ? new StartupCacheError({ cause: e, operation: "lock" }) : e
      )
    ) as Effect.Effect<StartupCacheResult, StartupCacheError>,
});
