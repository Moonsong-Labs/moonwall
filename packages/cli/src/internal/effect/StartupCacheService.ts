import { Command, type CommandExecutor, FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import type { PlatformError } from "@effect/platform/Error";
import { createLogger } from "@moonwall/util";
import { Context, Effect, Layer, Option, Stream } from "effect";
import * as crypto from "node:crypto";
import { withFileLock } from "./FileLock.js";
import { FileLockError, StartupCacheError } from "./errors.js";

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

type PlatformCommandR = FileSystem.FileSystem | Path.Path | CommandExecutor.CommandExecutor;

// =============================================================================
// Helpers
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

const checkCache = (
  cacheDir: string,
  hashPath: string,
  expectedHash: string
): Effect.Effect<Option.Option<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const savedHash = yield* fs.readFileString(hashPath).pipe(Effect.orElseSucceed(() => ""));
    if (savedHash.trim() !== expectedHash) return Option.none<string>();

    const exists = yield* fs.exists(cacheDir).pipe(Effect.orElseSucceed(() => false));
    if (!exists) return Option.none<string>();

    const files = yield* fs.readDirectory(cacheDir).pipe(Effect.orElseSucceed(() => []));
    const wasmFile = files.find((f) => f.startsWith("precompiled_wasm_") || f.endsWith(".cwasm"));
    if (!wasmFile) return Option.none<string>();

    const wasmPath = pathService.join(cacheDir, wasmFile);
    const accessible = yield* fs.access(wasmPath).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    );
    return accessible ? Option.some(wasmPath) : Option.none<string>();
  });

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
    const exitCode = yield* Command.exitCode(Command.make(binPath, ...args)).pipe(
      Effect.mapError(
        (e: PlatformError) => new StartupCacheError({ cause: e, operation: "precompile" })
      )
    );

    const files = yield* fs
      .readDirectory(outputDir)
      .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "precompile" })));
    const wasmFile = files.find((f) => f.startsWith("precompiled_wasm_") || f.endsWith(".cwasm"));
    if (!wasmFile) {
      return yield* Effect.fail(
        new StartupCacheError({
          cause: `precompile-wasm failed (code ${exitCode}): no WASM file`,
          operation: "precompile",
        })
      );
    }
    return pathService.join(outputDir, wasmFile);
  });

const maybeGenerateRawChainSpec = (
  binPath: string,
  chainName: string,
  outputPath: string,
  shouldGenerate: boolean
): Effect.Effect<string | undefined, never, PlatformCommandR> =>
  Effect.gen(function* () {
    if (!shouldGenerate) return undefined;

    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs.exists(outputPath).pipe(Effect.orElseSucceed(() => false));
    if (exists) return outputPath;

    const args =
      chainName === "dev" || chainName === "default"
        ? ["build-spec", "--dev", "--raw"]
        : ["build-spec", `--chain=${chainName}`, "--raw"];

    const stdout = yield* Command.string(Command.make(binPath, ...args)).pipe(
      Effect.orElseSucceed(() => "")
    );
    if (!stdout) return undefined;

    yield* fs.writeFileString(outputPath, stdout).pipe(Effect.ignore);
    return outputPath;
  });

// =============================================================================
// Main implementation
// =============================================================================

const getCachedArtifactsImpl = (
  config: StartupCacheConfig
): Effect.Effect<StartupCacheResult, StartupCacheError | FileLockError, PlatformCommandR> =>
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
    const rawSpecPath = pathService.join(cacheSubDir, `${chainName}-raw.json`);

    yield* fs
      .makeDirectory(cacheSubDir, { recursive: true })
      .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "cache" })));

    // Fast path: cache exists
    const cached = yield* checkCache(cacheSubDir, hashPath, binaryHash);
    if (Option.isSome(cached)) {
      logger.debug(`Cache hit: ${cached.value}`);
      const rawChainSpecPath = yield* maybeGenerateRawChainSpec(
        config.binPath,
        chainName,
        rawSpecPath,
        config.generateRawChainSpec ?? false
      );
      return { precompiledPath: cached.value, fromCache: true, rawChainSpecPath };
    }

    // Cache miss: acquire lock and build
    return yield* withFileLock(
      lockPath,
      Effect.gen(function* () {
        // Double-check after lock
        const nowCached = yield* checkCache(cacheSubDir, hashPath, binaryHash);
        if (Option.isSome(nowCached)) {
          logger.debug(`Cache hit after lock: ${nowCached.value}`);
          const rawChainSpecPath = yield* maybeGenerateRawChainSpec(
            config.binPath,
            chainName,
            rawSpecPath,
            config.generateRawChainSpec ?? false
          );
          return { precompiledPath: nowCached.value, fromCache: true, rawChainSpecPath };
        }

        // Build
        logger.debug("Building cache...");
        const wasmPath = yield* runPrecompile(config.binPath, config.chainArg, cacheSubDir);
        yield* fs
          .writeFileString(hashPath, binaryHash)
          .pipe(Effect.mapError((e) => new StartupCacheError({ cause: e, operation: "cache" })));
        const rawChainSpecPath = yield* maybeGenerateRawChainSpec(
          config.binPath,
          chainName,
          rawSpecPath,
          config.generateRawChainSpec ?? false
        );
        return { precompiledPath: wasmPath, fromCache: false, rawChainSpecPath };
      })
    );
  });

// =============================================================================
// Service Layer
// =============================================================================

export const StartupCacheServiceLive = Layer.succeed(StartupCacheService, {
  getCachedArtifacts: (config) =>
    getCachedArtifactsImpl(config).pipe(
      Effect.mapError((e) =>
        e instanceof FileLockError ? new StartupCacheError({ cause: e, operation: "lock" }) : e
      ),
      Effect.provide(NodeContext.layer)
    ),
});
