import { Context, Duration, Effect, Layer, Ref } from "effect";
import { createLogger } from "@moonwall/util";
import {
  ChopsticksFoundationService,
  type ChopsticksFoundationConfig,
  type ChopsticksFoundationRunningInfo,
  type ChopsticksFoundationStatus,
} from "./ChopsticksFoundationService.js";
import {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
} from "../errors/foundation.js";
import {
  type BlockCreationParams,
  type BlockCreationResult,
  ChopsticksBlockError,
  ChopsticksStorageError,
} from "../ChopsticksService.js";
import {
  launchChopsticksFromSpec,
  type ChopsticksFromSpecResult,
  type ChopsticksServiceImpl,
} from "../launchChopsticksEffect.js";
import type { HexString } from "@polkadot/util/types";
import {
  withTimeout,
  foundationStartupTimeout,
  healthCheckTimeout,
  blockCreationTimeout,
  storageOperationTimeout,
  TimeoutDefaults,
  type OperationTimeoutError,
} from "../TimeoutPolicy.js";
import { withFoundationSpan } from "../Tracing.js";

const logger = createLogger({ name: "ChopsticksFoundationService" });

/**
 * Internal state for the ChopsticksFoundationService.
 *
 * This tracks the current status, running instance information, and cleanup function.
 */
interface ChopsticksFoundationState {
  readonly status: ChopsticksFoundationStatus;
  readonly runningInfo: ChopsticksFoundationRunningInfo | null;
  readonly serviceImpl: ChopsticksServiceImpl | null;
  readonly cleanup: (() => Promise<void>) | null;
}

const initialState: ChopsticksFoundationState = {
  status: { _tag: "Stopped" },
  runningInfo: null,
  serviceImpl: null,
  cleanup: null,
};

/**
 * Create the ChopsticksFoundationService implementation.
 *
 * This factory creates a service instance with its own state ref.
 * The service uses the launchChopsticksFromSpec function to manage
 * the chopsticks lifecycle, wrapping the low-level ChopsticksService.
 */
const makeChopsticksFoundationService = Effect.gen(function* () {
  // Create a mutable ref to track state across method calls
  const stateRef = yield* Ref.make<ChopsticksFoundationState>(initialState);

  /**
   * Start a chopsticks foundation instance.
   *
   * The startup process is wrapped in a configurable timeout (default 2 minutes).
   */
  const start = (
    config: ChopsticksFoundationConfig
  ): Effect.Effect<
    {
      readonly info: ChopsticksFoundationRunningInfo;
      readonly stop: Effect.Effect<void, FoundationShutdownError>;
    },
    FoundationStartupError
  > => {
    // Inner startup logic extracted for timeout wrapping
    const startupEffect = Effect.gen(function* () {
      // Update status to Starting
      yield* Ref.set(stateRef, {
        status: { _tag: "Starting" },
        runningInfo: null,
        serviceImpl: null,
        cleanup: null,
      });

      logger.debug(
        `Starting chopsticks foundation: ${config.name} from config: ${config.configPath}`
      );

      // Launch chopsticks using the spec-based launcher
      let launchResult: ChopsticksFromSpecResult;
      try {
        launchResult = yield* Effect.tryPromise({
          try: () =>
            launchChopsticksFromSpec(config.launchSpec, {
              timeout: 120000, // 2 minute timeout for network operations
            }),
          catch: (error) =>
            new FoundationStartupError({
              foundationType: "chopsticks",
              message: `Failed to launch chopsticks "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
              cause: error,
            }),
        });
      } catch (error) {
        // Update state to Failed
        yield* Ref.set(stateRef, {
          status: { _tag: "Failed", error },
          runningInfo: null,
          serviceImpl: null,
          cleanup: null,
        });
        return yield* Effect.fail(
          error instanceof FoundationStartupError
            ? error
            : new FoundationStartupError({
                foundationType: "chopsticks",
                message: `Failed to launch chopsticks "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
                cause: error,
              })
        );
      }

      const endpoint = `ws://${launchResult.addr}`;
      const wsPort = launchResult.port;

      logger.debug(`Chopsticks launched at ${endpoint} for ${config.name}`);

      // Build running info
      const runningInfo: ChopsticksFoundationRunningInfo = {
        wsPort,
        endpoint,
        logPath: process.env.MOON_LOG_LOCATION,
        config,
      };

      // Update state to Running
      yield* Ref.set(stateRef, {
        status: { _tag: "Running", wsPort, endpoint },
        runningInfo,
        serviceImpl: launchResult.service,
        cleanup: launchResult.cleanup,
      });

      logger.info(`Chopsticks foundation "${config.name}" started successfully at ${endpoint}`);

      // Create the stop effect for this specific instance
      const stopEffect: Effect.Effect<void, FoundationShutdownError> = Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef);

        if (currentState.cleanup === null) {
          logger.warn(`Stop called but no cleanup function available for "${config.name}"`);
          return;
        }

        logger.debug(`Stopping chopsticks foundation "${config.name}"`);

        yield* Effect.tryPromise({
          try: () => currentState.cleanup!(),
          catch: (error) =>
            new FoundationShutdownError({
              foundationType: "chopsticks",
              message: `Failed to stop chopsticks "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
              cause: error,
            }),
        });

        // Update state to Stopped
        yield* Ref.set(stateRef, {
          status: { _tag: "Stopped" },
          runningInfo: null,
          serviceImpl: null,
          cleanup: null,
        });

        logger.info(`Chopsticks foundation "${config.name}" stopped`);
      });

      return {
        info: runningInfo,
        stop: stopEffect,
      };
    });

    // Wrap with configurable timeout, default to 2 minutes
    const timeoutDuration = config.startupTimeoutMs
      ? Duration.millis(config.startupTimeoutMs)
      : TimeoutDefaults.foundationStartup;

    return startupEffect.pipe(
      (effect) => withTimeout(effect, foundationStartupTimeout(config.name, timeoutDuration)),
      // Convert timeout error to FoundationStartupError for consistent API
      Effect.mapError((error) => {
        if (error._tag === "OperationTimeoutError") {
          return new FoundationStartupError({
            foundationType: "chopsticks",
            message: (error as OperationTimeoutError).userMessage,
            cause: error,
          });
        }
        return error;
      }),
      // Add tracing span for observability
      withFoundationSpan("chopsticks", "startup", config.name, {
        endpoint: `ws://localhost:${config.wsPort || 8000}`,
      })
    );
  };

  /**
   * Stop the running chopsticks foundation instance.
   */
  const stop = (): Effect.Effect<void, FoundationShutdownError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running") {
        logger.warn(
          `Stop called but foundation is not running (status: ${currentState.status._tag})`
        );
        return;
      }

      if (currentState.cleanup === null) {
        logger.warn("Stop called but no cleanup function available");
        return;
      }

      const instanceName = currentState.runningInfo?.config.name || "unknown";

      logger.debug(`Stopping chopsticks foundation "${instanceName}"`);

      yield* Effect.tryPromise({
        try: () => currentState.cleanup!(),
        catch: (error) =>
          new FoundationShutdownError({
            foundationType: "chopsticks",
            message: `Failed to stop chopsticks "${instanceName}": ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
            failedResources: currentState.runningInfo?.endpoint
              ? [currentState.runningInfo.endpoint]
              : undefined,
          }),
      });

      // Update state to Stopped
      yield* Ref.set(stateRef, {
        status: { _tag: "Stopped" },
        runningInfo: null,
        serviceImpl: null,
        cleanup: null,
      });

      logger.info(`Chopsticks foundation "${instanceName}" stopped`);
    }).pipe(
      // Add tracing span for observability
      withFoundationSpan("chopsticks", "shutdown", "chopsticks-foundation")
    );

  /**
   * Get the current status of the chopsticks foundation.
   */
  const getStatus = (): Effect.Effect<ChopsticksFoundationStatus> =>
    Ref.get(stateRef).pipe(Effect.map((state) => state.status));

  /**
   * Perform a health check on the running chopsticks instance.
   *
   * Uses the chopsticks service to verify the instance is responsive by
   * attempting to get the current head block.
   */
  const healthCheck = (): Effect.Effect<void, FoundationHealthCheckError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running") {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "chopsticks",
            message: `Cannot health check: foundation is not running (status: ${currentState.status._tag})`,
          })
        );
      }

      if (currentState.serviceImpl === null) {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "chopsticks",
            message: "Cannot health check: no service implementation available",
          })
        );
      }

      const { endpoint } = currentState.status;

      // Try to get the head block to verify the instance is responsive
      const getBlockResult = yield* currentState.serviceImpl.getBlock().pipe(
        Effect.mapError(
          (error: ChopsticksBlockError) =>
            new FoundationHealthCheckError({
              foundationType: "chopsticks",
              message: `Health check failed for ${endpoint}: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`,
              endpoint,
              cause: error,
            })
        )
      );

      if (getBlockResult === undefined) {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "chopsticks",
            message: `Health check failed for ${endpoint}: no head block found`,
            endpoint,
          })
        );
      }

      logger.debug(`Health check passed for ${endpoint} (head: #${getBlockResult.number})`);
    }).pipe(
      Effect.asVoid,
      // Add tracing span for observability
      withFoundationSpan("chopsticks", "healthCheck", "chopsticks-foundation")
    );

  /**
   * Create one or more new blocks.
   *
   * Includes a configurable timeout (default 30 seconds) to prevent hanging on slow block production.
   */
  const createBlock = (
    params?: BlockCreationParams
  ): Effect.Effect<BlockCreationResult, ChopsticksBlockError> => {
    const blockCreationEffect = Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running" || currentState.serviceImpl === null) {
        return yield* Effect.fail(
          new ChopsticksBlockError({
            cause: new Error("Cannot create block: chopsticks is not running"),
            operation: "newBlock",
          })
        );
      }

      const result: BlockCreationResult = yield* currentState.serviceImpl.createBlock(params);
      return result;
    });

    // Get timeout from config (stored in state) or use default
    const getTimeoutDuration = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef);
      const configTimeout = state.runningInfo?.config.blockCreationTimeoutMs;
      return configTimeout ? Duration.millis(configTimeout) : TimeoutDefaults.blockCreation;
    });

    return getTimeoutDuration.pipe(
      Effect.flatMap((timeoutDuration) =>
        blockCreationEffect.pipe(
          (effect) =>
            withTimeout(effect, blockCreationTimeout(params?.count ?? 1, timeoutDuration)),
          // Convert timeout error to ChopsticksBlockError for consistent API
          Effect.mapError((error) => {
            if (error._tag === "OperationTimeoutError") {
              return new ChopsticksBlockError({
                cause: new Error((error as OperationTimeoutError).userMessage),
                operation: "newBlock",
              });
            }
            return error;
          }),
          // Add tracing span for observability
          withFoundationSpan("chopsticks", "createBlock", "chopsticks-foundation")
        )
      )
    );
  };

  /**
   * Set storage values directly.
   *
   * Includes a 10-second timeout to prevent hanging on slow storage operations.
   */
  const setStorage = (params: {
    module: string;
    method: string;
    params: unknown[];
  }): Effect.Effect<void, ChopsticksStorageError> => {
    const setStorageEffect = Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running" || currentState.serviceImpl === null) {
        return yield* Effect.fail(
          new ChopsticksStorageError({
            cause: new Error("Cannot set storage: chopsticks is not running"),
            module: params.module,
            method: params.method,
          })
        );
      }

      yield* currentState.serviceImpl.setStorage(params);
    });

    return setStorageEffect.pipe(
      (effect) =>
        withTimeout(
          effect,
          storageOperationTimeout(`setStorage(${params.module}.${params.method})`)
        ),
      // Convert timeout error to ChopsticksStorageError for consistent API
      Effect.mapError((error) => {
        if (error._tag === "OperationTimeoutError") {
          return new ChopsticksStorageError({
            cause: new Error((error as OperationTimeoutError).userMessage),
            module: params.module,
            method: params.method,
          });
        }
        return error;
      }),
      // Add tracing span for observability
      withFoundationSpan("chopsticks", "setStorage", "chopsticks-foundation")
    );
  };

  /**
   * Get a block by hash or number.
   */
  const getBlock = (
    hashOrNumber?: HexString | number
  ): Effect.Effect<{ hash: HexString; number: number } | undefined, ChopsticksBlockError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running" || currentState.serviceImpl === null) {
        return yield* Effect.fail(
          new ChopsticksBlockError({
            cause: new Error("Cannot get block: chopsticks is not running"),
            operation: "getBlock",
            blockIdentifier: hashOrNumber,
          })
        );
      }

      const result: { hash: HexString; number: number } | undefined =
        yield* currentState.serviceImpl.getBlock(hashOrNumber);
      return result;
    });

  /**
   * Set the head of the chain to a specific block.
   */
  const setHead = (hashOrNumber: HexString | number): Effect.Effect<void, ChopsticksBlockError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running" || currentState.serviceImpl === null) {
        return yield* Effect.fail(
          new ChopsticksBlockError({
            cause: new Error("Cannot set head: chopsticks is not running"),
            operation: "setHead",
            blockIdentifier: hashOrNumber,
          })
        );
      }

      yield* currentState.serviceImpl.setHead(hashOrNumber);
    });

  return {
    start,
    stop,
    getStatus,
    healthCheck,
    createBlock,
    setStorage,
    getBlock,
    setHead,
  } satisfies Context.Tag.Service<ChopsticksFoundationService>;
});

/**
 * Live implementation of ChopsticksFoundationService.
 *
 * This Layer provides a fully functional ChopsticksFoundationService that:
 * - Launches chopsticks from YAML/JSON configuration files
 * - Manages the chopsticks WebSocket server lifecycle
 * - Provides block creation and storage manipulation
 * - Handles graceful shutdown with cleanup
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { ChopsticksFoundationService, ChopsticksFoundationServiceLive } from "./services/index.js";
 *
 * const program = Effect.gen(function* () {
 *   const chopsticks = yield* ChopsticksFoundationService;
 *   const { info, stop } = yield* chopsticks.start({
 *     configPath: "./moonbeam.yml",
 *     name: "moonbeam-fork",
 *     launchSpec: spec,
 *   });
 *   console.log(`Fork running at ${info.endpoint}`);
 *
 *   // Create a block
 *   const block = yield* chopsticks.createBlock();
 *   console.log(`Created block #${block.block.number}`);
 *
 *   yield* stop;
 * }).pipe(Effect.provide(ChopsticksFoundationServiceLive));
 * ```
 */
export const ChopsticksFoundationServiceLive: Layer.Layer<ChopsticksFoundationService> =
  Layer.effect(ChopsticksFoundationService, makeChopsticksFoundationService);

/**
 * Create a ChopsticksFoundationService layer for testing.
 *
 * Since ChopsticksFoundationService doesn't have injectable dependencies
 * (it uses launchChopsticksFromSpec directly), this is mainly useful for
 * creating isolated instances in tests.
 *
 * For mocking in tests, use Layer.succeed to provide a mock implementation
 * of the ChopsticksFoundationService interface directly.
 *
 * @returns Layer providing ChopsticksFoundationService
 */
export const makeChopsticksFoundationServiceLayer = (): Layer.Layer<ChopsticksFoundationService> =>
  Layer.effect(ChopsticksFoundationService, makeChopsticksFoundationService);
