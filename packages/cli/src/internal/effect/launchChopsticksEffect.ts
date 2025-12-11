/**
 * Effect-based Chopsticks launcher with manual cleanup support
 *
 * This module provides a programmatic way to launch chopsticks instances
 * using the Effect pattern, replacing the previous CLI subprocess approach.
 *
 * Like launchNodeEffect, it returns a cleanup function rather than using
 * Effect scopes, because the chopsticks instance needs to persist across
 * test suites (not just a single Effect scope).
 */

import { Effect, Layer, type Scope } from "effect";
import type { HexString } from "@polkadot/util/types";
import { createLogger } from "@moonwall/util";
import type { ChopsticksLaunchSpec } from "@moonwall/types";
import * as fs from "node:fs";
import * as path from "node:path";

// We use dynamic imports for chopsticks to allow configuring the logger
// BEFORE any chopsticks code runs. This is necessary because chopsticks
// creates child loggers at module load time.
import type { Blockchain, BuildBlockMode } from "@acala-network/chopsticks";

// Re-export BuildBlockMode values for consumers who need them before dynamic import
// These match the values from @acala-network/chopsticks
export const BuildBlockModeValues = {
  Batch: "Batch",
  Manual: "Manual",
  Instant: "Instant",
} as const;
export type { BuildBlockMode };

// Flag to track if chopsticks logger has been configured
let chopsticksLoggerConfigured = false;

// Cache for dynamically imported chopsticks modules
let chopsticksModuleCache: {
  setupWithServer: typeof import("@acala-network/chopsticks").setupWithServer;
  setStorage: typeof import("@acala-network/chopsticks").setStorage;
  pinoLogger: typeof import("@acala-network/chopsticks").pinoLogger;
  defaultLogger: typeof import("@acala-network/chopsticks").defaultLogger;
} | null = null;
import {
  type ChopsticksConfig,
  type BlockCreationParams,
  type BlockCreationResult,
  type DryRunResult,
  ChopsticksService,
  ChopsticksConfigTag,
  ChopsticksSetupError,
  ChopsticksBlockError,
  ChopsticksStorageError,
  ChopsticksExtrinsicError,
  ChopsticksXcmError,
  ChopsticksCleanupError,
} from "./ChopsticksService.js";
import { parseChopsticksConfigFile } from "./chopsticksConfigParser.js";

const logger = createLogger({ name: "launchChopsticksEffect" });

/**
 * Create a log file for chopsticks output
 * Returns the log file path and a write stream
 */
function createLogFile(port: number): { logPath: string; writeStream: fs.WriteStream } {
  const dirPath = path.join(process.cwd(), "tmp", "node_logs");

  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const logPath = path.join(dirPath, `chopsticks_${port}_${Date.now()}.log`);
  const writeStream = fs.createWriteStream(logPath);

  // Set env var so other parts of moonwall can find it
  process.env.MOON_LOG_LOCATION = logPath;

  return { logPath, writeStream };
}

/**
 * Write a log entry to the chopsticks log file
 */
function writeLog(stream: fs.WriteStream, level: string, message: string): void {
  const timestamp = new Date().toISOString();
  stream.write(`[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
}

// Store reference to log file stream for chopsticks integration
let chopsticksLogStream: fs.WriteStream | null = null;

/**
 * Set the log stream for chopsticks to write to
 */
export function setChopsticksLogStream(stream: fs.WriteStream | null): void {
  chopsticksLogStream = stream;
}

/**
 * Hook into a pino logger to also write to the moonwall log file
 * This preserves the original pino-pretty console output while adding file logging
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hookLoggerToFile(pinoInstance: any, loggerName: string): void {
  const wrapMethod = (level: string, originalMethod: (...args: unknown[]) => void) => {
    return function (this: unknown, ...args: unknown[]) {
      // Call original pino-pretty output
      originalMethod.apply(this, args);

      // Also write to our log file
      if (chopsticksLogStream && args.length > 0) {
        const timestamp = new Date().toISOString();
        const message = typeof args[0] === "string" ? args[0] : JSON.stringify(args[0]);
        chopsticksLogStream.write(
          `[${timestamp}] [${level.toUpperCase()}] (${loggerName}) ${message}\n`
        );
      }
    };
  };

  // Wrap each log method
  const originalInfo = pinoInstance.info.bind(pinoInstance);
  const originalWarn = pinoInstance.warn.bind(pinoInstance);
  const originalError = pinoInstance.error.bind(pinoInstance);
  const originalDebug = pinoInstance.debug.bind(pinoInstance);

  pinoInstance.info = wrapMethod("info", originalInfo);
  pinoInstance.warn = wrapMethod("warn", originalWarn);
  pinoInstance.error = wrapMethod("error", originalError);
  pinoInstance.debug = wrapMethod("debug", originalDebug);

  // Also wrap child method to hook child loggers
  const originalChild = pinoInstance.child?.bind(pinoInstance);
  if (originalChild) {
    pinoInstance.child = (bindings: Record<string, unknown>) => {
      const child = originalChild(bindings);
      const childName = (bindings.name as string) || (bindings.child as string) || loggerName;
      hookLoggerToFile(child, childName);
      return child;
    };
  }
}

/**
 * Configure the chopsticks internal logger (synchronous version)
 * Only works if chopsticks has already been imported.
 */
export function configureChopsticksLogger(level: string = "inherit"): void {
  // Only configure once - first call wins
  if (chopsticksLoggerConfigured) {
    return;
  }

  // If chopsticks hasn't been loaded yet, mark as configured so
  // getChopsticksModules will handle it
  chopsticksLoggerConfigured = true;

  if (!chopsticksModuleCache) {
    // Will be configured when modules are loaded
    return;
  }

  const resolvedLevel = level === "inherit" ? process.env.LOG_LEVEL || "info" : level;

  chopsticksModuleCache.pinoLogger.level = resolvedLevel;
  logger.debug(`Chopsticks internal logger level: ${resolvedLevel}`);
}

/**
 * Get chopsticks modules, dynamically importing if needed.
 * Also hooks the chopsticks logger to write to our log file.
 *
 * @param logLevel - Log level to use (default: inherit from LOG_LEVEL env)
 */
async function getChopsticksModules(logLevel: string = "inherit") {
  if (chopsticksModuleCache) {
    return chopsticksModuleCache;
  }

  // Dynamically import chopsticks
  const chopsticks = await import("@acala-network/chopsticks");

  chopsticksModuleCache = {
    setupWithServer: chopsticks.setupWithServer,
    setStorage: chopsticks.setStorage,
    pinoLogger: chopsticks.pinoLogger,
    defaultLogger: chopsticks.defaultLogger,
  };

  // Configure log level if specified
  const resolvedLevel = logLevel === "inherit" ? process.env.LOG_LEVEL || "info" : logLevel;
  chopsticksModuleCache.pinoLogger.level = resolvedLevel;

  // Hook the defaultLogger (and future children) to also write to our log file
  hookLoggerToFile(chopsticksModuleCache.defaultLogger, "chopsticks");

  chopsticksLoggerConfigured = true;
  logger.debug(`Chopsticks internal logger level: ${resolvedLevel}`);

  return chopsticksModuleCache;
}

// =============================================================================
// Types
// =============================================================================

/**
 * Result from launching a chopsticks instance
 */
export interface ChopsticksLaunchResult {
  /** Direct access to the blockchain instance */
  readonly chain: Blockchain;
  /** WebSocket address (e.g., "127.0.0.1:8000") */
  readonly addr: string;
  /** Port number */
  readonly port: number;
}

/**
 * Service implementation returned by launchChopsticksEffect
 */
export interface ChopsticksServiceImpl {
  readonly chain: Blockchain;
  readonly addr: string;
  readonly port: number;
  readonly createBlock: (
    params?: BlockCreationParams
  ) => Effect.Effect<BlockCreationResult, ChopsticksBlockError>;
  readonly setStorage: (params: {
    module: string;
    method: string;
    params: unknown[];
  }) => Effect.Effect<void, ChopsticksStorageError>;
  readonly submitExtrinsic: (
    extrinsic: HexString
  ) => Effect.Effect<HexString, ChopsticksExtrinsicError>;
  readonly dryRunExtrinsic: (
    extrinsic: HexString | { call: HexString; address: string },
    at?: HexString
  ) => Effect.Effect<DryRunResult, ChopsticksExtrinsicError>;
  readonly getBlock: (
    hashOrNumber?: HexString | number
  ) => Effect.Effect<{ hash: HexString; number: number } | undefined, ChopsticksBlockError>;
  readonly setHead: (hashOrNumber: HexString | number) => Effect.Effect<void, ChopsticksBlockError>;
  readonly submitUpwardMessages: (
    paraId: number,
    messages: HexString[]
  ) => Effect.Effect<void, ChopsticksXcmError>;
  readonly submitDownwardMessages: (
    messages: Array<{ sentAt: number; msg: HexString }>
  ) => Effect.Effect<void, ChopsticksXcmError>;
  readonly submitHorizontalMessages: (
    paraId: number,
    messages: Array<{ sentAt: number; data: HexString }>
  ) => Effect.Effect<void, ChopsticksXcmError>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract a single endpoint string from the config.
 * The ChopsticksConfig endpoint can be a string, array of strings, or undefined.
 */
const getEndpointString = (endpoint: string | string[] | undefined): string | undefined => {
  if (typeof endpoint === "string") return endpoint;
  if (Array.isArray(endpoint)) return endpoint[0];
  return undefined;
};

/**
 * Prepare ChopsticksConfig for setupWithServer by ensuring defaults.
 *
 * Since ChopsticksConfig is now the native chopsticks type (with kebab-case keys),
 * we just need to ensure required defaults are set.
 */
const prepareConfigForSetup = (config: ChopsticksConfig): ChopsticksConfig => ({
  ...config,
  port: config.port ?? 8000,
  host: config.host ?? "127.0.0.1",
  "build-block-mode": config["build-block-mode"] ?? ("Manual" as BuildBlockMode),
});

/**
 * Create service implementation methods that wrap the chain's methods in Effects
 */
const createServiceMethods = (
  chain: Blockchain
): Omit<ChopsticksServiceImpl, "chain" | "addr" | "port"> => ({
  createBlock: (params?: BlockCreationParams) =>
    Effect.tryPromise({
      try: async () => {
        const block = await chain.newBlock({
          transactions: params?.transactions ?? [],
          upwardMessages: params?.ump ?? {},
          downwardMessages: params?.dmp ?? [],
          horizontalMessages: params?.hrmp ?? {},
        });
        return {
          block: {
            hash: block.hash as HexString,
            number: block.number,
          },
        };
      },
      catch: (cause) =>
        new ChopsticksBlockError({
          cause,
          operation: "newBlock",
        }),
    }),

  setStorage: (params) =>
    Effect.tryPromise({
      try: async () => {
        // Use the chopsticks utility function to set storage
        const storage = { [params.module]: { [params.method]: params.params } };
        const modules = await getChopsticksModules();
        await modules.setStorage(chain, storage);
      },
      catch: (cause) =>
        new ChopsticksStorageError({
          cause,
          module: params.module,
          method: params.method,
        }),
    }),

  submitExtrinsic: (extrinsic) =>
    Effect.tryPromise({
      try: () => chain.submitExtrinsic(extrinsic),
      catch: (cause) =>
        new ChopsticksExtrinsicError({
          cause,
          operation: "submit",
          extrinsic,
        }),
    }),

  dryRunExtrinsic: (extrinsic, at) =>
    Effect.tryPromise({
      try: async () => {
        const result = await chain.dryRunExtrinsic(extrinsic, at);
        const isOk = result.outcome.isOk;
        return {
          success: isOk,
          storageDiff: result.storageDiff,
          error: isOk ? undefined : result.outcome.asErr?.toString(),
        };
      },
      catch: (cause) =>
        new ChopsticksExtrinsicError({
          cause,
          operation: "dryRun",
          extrinsic: typeof extrinsic === "string" ? extrinsic : extrinsic.call,
        }),
    }),

  getBlock: (hashOrNumber) =>
    Effect.tryPromise({
      try: async () => {
        const block =
          hashOrNumber === undefined
            ? chain.head
            : typeof hashOrNumber === "number"
              ? await chain.getBlockAt(hashOrNumber)
              : await chain.getBlock(hashOrNumber);

        if (!block) return undefined;
        return {
          hash: block.hash as HexString,
          number: block.number,
        };
      },
      catch: (cause) =>
        new ChopsticksBlockError({
          cause,
          operation: "getBlock",
          blockIdentifier: hashOrNumber,
        }),
    }),

  setHead: (hashOrNumber) =>
    Effect.tryPromise({
      try: async () => {
        const block =
          typeof hashOrNumber === "number"
            ? await chain.getBlockAt(hashOrNumber)
            : await chain.getBlock(hashOrNumber);

        if (!block) {
          throw new Error(`Block not found: ${hashOrNumber}`);
        }
        await chain.setHead(block);
      },
      catch: (cause) =>
        new ChopsticksBlockError({
          cause,
          operation: "setHead",
          blockIdentifier: hashOrNumber,
        }),
    }),

  submitUpwardMessages: (paraId, messages) =>
    Effect.try({
      try: () => chain.submitUpwardMessages(paraId, messages),
      catch: (cause) =>
        new ChopsticksXcmError({
          cause,
          messageType: "ump",
          paraId,
        }),
    }),

  submitDownwardMessages: (messages) =>
    Effect.try({
      try: () => chain.submitDownwardMessages(messages),
      catch: (cause) =>
        new ChopsticksXcmError({
          cause,
          messageType: "dmp",
        }),
    }),

  submitHorizontalMessages: (paraId, messages) =>
    Effect.try({
      try: () => chain.submitHorizontalMessages(paraId, messages),
      catch: (cause) =>
        new ChopsticksXcmError({
          cause,
          messageType: "hrmp",
          paraId,
        }),
    }),
});

// =============================================================================
// Main Launch Function
// =============================================================================

/**
 * Launch a chopsticks instance with manual cleanup support
 *
 * This function uses the programmatic setupWithServer API from @acala-network/chopsticks
 * instead of spawning a CLI subprocess. It returns the chopsticks instance along with
 * a cleanup function that should be called when the instance is no longer needed.
 *
 * @param config - Chopsticks configuration
 * @returns Promise with the launch result and cleanup function
 *
 * @example
 * ```typescript
 * const { result, cleanup } = await launchChopsticksEffect({
 *   endpoint: "wss://rpc.polkadot.io",
 *   port: 8000,
 *   buildBlockMode: BuildBlockMode.Manual,
 * });
 *
 * // Use the chopsticks instance
 * const block = await Effect.runPromise(result.createBlock());
 *
 * // When done, cleanup
 * await cleanup();
 * ```
 */
export async function launchChopsticksEffect(config: ChopsticksConfig): Promise<{
  result: ChopsticksServiceImpl;
  cleanup: () => Promise<void>;
}> {
  const startTime = Date.now();
  logger.debug(`[T+0ms] Starting chopsticks with endpoint: ${config.endpoint}`);

  // Create log file BEFORE loading chopsticks modules so the logger hooks can use it
  const port = config.port ?? 8000;
  const { logPath, writeStream } = createLogFile(port);
  setChopsticksLogStream(writeStream);

  const program = Effect.gen(function* () {
    // Get chopsticks modules - this also configures and hooks the logger
    const chopsticksModules = yield* Effect.promise(() => getChopsticksModules("inherit"));

    // Convert config to chopsticks format
    const args = prepareConfigForSetup(config);
    logger.debug(`[T+${Date.now() - startTime}ms] Calling setupWithServer...`);

    // Setup chopsticks programmatically
    const context = yield* Effect.tryPromise({
      try: () => chopsticksModules.setupWithServer(args),
      catch: (cause) =>
        new ChopsticksSetupError({
          cause,
          endpoint: getEndpointString(config.endpoint),
          block: config.block ?? undefined,
        }),
    });

    // Parse actual port from addr (format: "host:port")
    const actualPort = Number.parseInt(context.addr.split(":")[1], 10);

    // Log with moonwall's logger for consistent formatting
    const chainName = yield* Effect.promise(() => context.chain.api.getSystemChain());
    logger.info(`${chainName} RPC listening on ws://${context.addr}`);
    logger.debug(`[T+${Date.now() - startTime}ms] Chopsticks started at ${context.addr}`);
    logger.debug(`Log file: ${logPath}`);

    // Write startup info to log file
    writeLog(writeStream, "info", `Chopsticks started for ${chainName}`);
    writeLog(writeStream, "info", `RPC listening on ws://${context.addr}`);
    writeLog(writeStream, "info", `Endpoint: ${config.endpoint}`);
    if (config.block) {
      writeLog(writeStream, "info", `Block: ${config.block}`);
    }

    // Create the cleanup effect
    const cleanup = Effect.tryPromise({
      try: async () => {
        logger.debug("Closing chopsticks...");
        writeLog(writeStream, "info", "Shutting down chopsticks...");
        await context.close();
        writeLog(writeStream, "info", "Chopsticks closed");
        setChopsticksLogStream(null); // Stop writing to file
        writeStream.end();
        logger.debug("Chopsticks closed");
      },
      catch: (cause) => new ChopsticksCleanupError({ cause }),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          logger.error(`Failed to cleanly close chopsticks: ${error}`);
          writeLog(writeStream, "error", `Failed to close: ${error}`);
          setChopsticksLogStream(null);
          writeStream.end();
        })
      )
    );

    // Create the service implementation
    const serviceMethods = createServiceMethods(context.chain);
    const service: ChopsticksServiceImpl = {
      chain: context.chain,
      addr: context.addr,
      port: actualPort,
      ...serviceMethods,
    };

    return { service, cleanup };
  });

  // Run the program and return result with cleanup function
  const { service, cleanup } = await Effect.runPromise(program);

  return {
    result: service,
    cleanup: () => Effect.runPromise(cleanup),
  };
}

/**
 * Launch chopsticks as an Effect (for use within Effect pipelines)
 *
 * Unlike launchChopsticksEffect, this version returns the result as an Effect
 * rather than a Promise. Use this when you want to compose the launch with
 * other Effects.
 *
 * @param config - Chopsticks configuration
 * @returns Effect with launch result and cleanup
 */
export const launchChopsticksEffectProgram = (
  config: ChopsticksConfig
): Effect.Effect<
  { result: ChopsticksServiceImpl; cleanup: Effect.Effect<void, never> },
  ChopsticksSetupError
> =>
  Effect.gen(function* () {
    const chopsticksModules = yield* Effect.promise(() => getChopsticksModules("silent"));
    const args = prepareConfigForSetup(config);

    const context = yield* Effect.tryPromise({
      try: () => chopsticksModules.setupWithServer(args),
      catch: (cause) =>
        new ChopsticksSetupError({
          cause,
          endpoint: getEndpointString(config.endpoint),
          block: config.block ?? undefined,
        }),
    });

    const port = Number.parseInt(context.addr.split(":")[1], 10);

    const cleanup = Effect.tryPromise({
      try: () => context.close(),
      catch: (cause) => new ChopsticksCleanupError({ cause }),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          logger.error(`Failed to cleanly close chopsticks: ${error}`);
        })
      )
    );

    const serviceMethods = createServiceMethods(context.chain);
    const service: ChopsticksServiceImpl = {
      chain: context.chain,
      addr: context.addr,
      port,
      ...serviceMethods,
    };

    return { result: service, cleanup };
  });

// =============================================================================
// Layer.scoped Implementation (Phase 3)
// =============================================================================

/**
 * Internal context type returned by setupWithServer
 */
interface ChopsticksContext {
  chain: Blockchain;
  addr: string;
  close: () => Promise<void>;
}

/**
 * Acquire a chopsticks instance with automatic cleanup on scope finalization
 *
 * This uses Effect.acquireRelease to ensure the chopsticks instance is properly
 * cleaned up when the Effect scope ends, even if an error occurs.
 */
const acquireChopsticks = (
  config: ChopsticksConfig
): Effect.Effect<ChopsticksContext, ChopsticksSetupError, Scope.Scope> =>
  Effect.acquireRelease(
    // Acquire: Setup chopsticks (first get modules, then setup)
    Effect.promise(() => getChopsticksModules("silent")).pipe(
      Effect.flatMap((modules) =>
        Effect.tryPromise({
          try: () => modules.setupWithServer(prepareConfigForSetup(config)),
          catch: (cause) =>
            new ChopsticksSetupError({
              cause,
              endpoint: getEndpointString(config.endpoint),
              block: config.block ?? undefined,
            }),
        })
      ),
      Effect.tap((context) =>
        Effect.sync(() => logger.debug(`Chopsticks started at ${context.addr}`))
      )
    ),
    // Release: Cleanup chopsticks
    (context) =>
      Effect.tryPromise({
        try: async () => {
          logger.debug("Closing chopsticks...");
          await context.close();
          logger.debug("Chopsticks closed");
        },
        catch: (cause) => new ChopsticksCleanupError({ cause }),
      }).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            logger.error(`Failed to cleanly close chopsticks: ${error}`);
          })
        )
      )
  );

/**
 * Create a ChopsticksService Layer that automatically manages the chopsticks lifecycle
 *
 * This Layer uses Effect.acquireRelease under the hood, ensuring that the chopsticks
 * instance is properly cleaned up when the Layer scope ends (e.g., when the test
 * suite finishes or when Effect.runPromise completes).
 *
 * @param config - Chopsticks configuration
 * @returns A scoped Layer providing ChopsticksService
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const chopsticks = yield* ChopsticksService;
 *   const block = yield* chopsticks.createBlock();
 *   return block;
 * });
 *
 * // The chopsticks instance will be automatically cleaned up when runPromise completes
 * const result = await Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(ChopsticksServiceLayer({
 *       endpoint: "wss://rpc.polkadot.io",
 *       port: 8000,
 *     }))
 *   )
 * );
 * ```
 */
export const ChopsticksServiceLayer = (
  config: ChopsticksConfig
): Layer.Layer<ChopsticksService, ChopsticksSetupError> =>
  Layer.scoped(
    ChopsticksService,
    Effect.gen(function* () {
      const context = yield* acquireChopsticks(config);
      const port = Number.parseInt(context.addr.split(":")[1], 10);
      const serviceMethods = createServiceMethods(context.chain);

      return {
        chain: context.chain,
        addr: context.addr,
        port,
        ...serviceMethods,
      };
    })
  );

/**
 * Create a ChopsticksService Layer from a ChopsticksConfigTag dependency
 *
 * This Layer reads the configuration from the ChopsticksConfigTag context,
 * allowing for dependency injection of the configuration.
 *
 * @example
 * ```typescript
 * const configLayer = Layer.succeed(ChopsticksConfigTag, {
 *   endpoint: "wss://rpc.polkadot.io",
 *   port: 8000,
 * });
 *
 * const program = Effect.gen(function* () {
 *   const chopsticks = yield* ChopsticksService;
 *   return chopsticks.addr;
 * });
 *
 * const result = await Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(ChopsticksServiceLive),
 *     Effect.provide(configLayer)
 *   )
 * );
 * ```
 */
export const ChopsticksServiceLive: Layer.Layer<
  ChopsticksService,
  ChopsticksSetupError,
  ChopsticksConfigTag
> = Layer.scoped(
  ChopsticksService,
  Effect.gen(function* () {
    const config = yield* ChopsticksConfigTag;
    const context = yield* acquireChopsticks(config);
    const port = Number.parseInt(context.addr.split(":")[1], 10);
    const serviceMethods = createServiceMethods(context.chain);

    return {
      chain: context.chain,
      addr: context.addr,
      port,
      ...serviceMethods,
    };
  })
);

// =============================================================================
// Bridge Function: ChopsticksLaunchSpec → Programmatic Launch
// =============================================================================

/**
 * Result from launching chopsticks via spec
 * Compatible with the existing node launch result structure
 */
export interface ChopsticksFromSpecResult {
  /** The chopsticks service implementation */
  readonly service: ChopsticksServiceImpl;
  /** Cleanup function to call when done */
  readonly cleanup: () => Promise<void>;
  /** WebSocket port the instance is listening on */
  readonly port: number;
  /** WebSocket address (host:port) */
  readonly addr: string;
}

/**
 * Launch chopsticks from a ChopsticksLaunchSpec by parsing the YAML config file
 * and using the programmatic API.
 *
 * This function bridges the existing Moonwall config format to the new
 * programmatic chopsticks launcher, providing:
 * - Early validation of the config file (including env var resolution)
 * - Clear error messages for missing/invalid config
 * - Proper Effect-based error handling
 *
 * @param spec - The ChopsticksLaunchSpec from moonwall config
 * @param options - Additional options
 * @returns Promise with the launch result and cleanup function
 *
 * @example
 * ```typescript
 * const result = await launchChopsticksFromSpec({
 *   configPath: "./chopsticks-config.yml",
 *   wsPort: 8000,
 *   buildBlockMode: "manual",
 * });
 *
 * // Use the service
 * await Effect.runPromise(result.service.createBlock());
 *
 * // Cleanup when done
 * await result.cleanup();
 * ```
 */
export async function launchChopsticksFromSpec(
  spec: ChopsticksLaunchSpec,
  options?: {
    /** Timeout in milliseconds for setup (default: 60000) */
    timeout?: number;
    /** Log level for chopsticks internal logger ('silent' to suppress, default: matches LOG_LEVEL env) */
    chopsticksLogLevel?: string;
  }
): Promise<ChopsticksFromSpecResult> {
  const timeout = options?.timeout ?? 60000;
  const startTime = Date.now();

  // Note: Logger configuration is now handled in getChopsticksModules() when
  // chopsticks is dynamically imported. The chopsticksLogLevel option is kept
  // for backwards compatibility but has no effect.

  logger.debug(`Launching chopsticks from spec: ${spec.configPath}`);

  // Parse and validate the config file (with env var resolution)
  const parseEffect = parseChopsticksConfigFile(spec.configPath, {
    port: spec.wsPort,
    host: spec.address,
    buildBlockMode: spec.buildBlockMode,
    wasmOverride: spec.wasmOverride,
    allowUnresolvedImports: spec.allowUnresolvedImports,
  });

  // Add timeout to the parse + launch operation
  let configResult: ChopsticksConfig;
  try {
    configResult = await Effect.runPromise(
      parseEffect.pipe(
        Effect.timeout(timeout),
        Effect.catchTag("TimeoutException", () =>
          Effect.fail(
            new ChopsticksSetupError({
              cause: new Error(`Config parsing timed out after ${timeout}ms`),
              endpoint: spec.configPath,
            })
          )
        )
      )
    );
  } catch (error: unknown) {
    // Re-throw with clearer message that includes the actual cause
    // Effect errors format their toString() nicely, extract the [cause] part if present
    const errorString = String(error);

    // Extract the relevant cause message from Effect's error format
    // Format: "(FiberFailure) ChopsticksSetupError: ... [cause]: Error: actual message"
    const causeMatch = errorString.match(/\[cause\]:\s*Error:\s*(.+)/s);
    if (causeMatch) {
      throw new Error(`Chopsticks config validation failed: ${causeMatch[1].trim()}`);
    }

    // Fallback to full error string
    throw new Error(`Chopsticks config validation failed: ${errorString}`);
  }

  logger.debug(`Config parsed in ${Date.now() - startTime}ms`);
  logger.debug(`  endpoint: ${configResult.endpoint}`);
  logger.debug(`  port: ${configResult.port}`);

  // Launch using the programmatic API
  let service: ChopsticksServiceImpl;
  let cleanup: () => Promise<void>;
  try {
    const result = await launchChopsticksEffect(configResult);
    service = result.result;
    cleanup = result.cleanup;
  } catch (error: unknown) {
    // Re-throw with clearer message - use same extraction as config validation
    const errorString = String(error);
    const causeMatch = errorString.match(/\[cause\]:\s*Error:\s*(.+)/s);
    const causeMessage = causeMatch ? causeMatch[1].trim() : errorString;

    throw new Error(
      `Chopsticks failed to connect to endpoint '${configResult.endpoint}': ${causeMessage}`
    );
  }

  logger.debug(`Chopsticks launched in ${Date.now() - startTime}ms at ${service.addr}`);

  return {
    service,
    cleanup,
    port: service.port,
    addr: service.addr,
  };
}
