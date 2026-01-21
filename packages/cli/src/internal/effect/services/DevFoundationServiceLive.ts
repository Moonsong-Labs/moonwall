import { Duration, Effect, Layer, Ref } from "effect";
import type { ChildProcess } from "node:child_process";
import { createLogger } from "@moonwall/util";
import {
  DevFoundationService,
  type DevFoundationConfig,
  type DevFoundationRunningInfo,
  type DevFoundationStatus,
} from "./DevFoundationService.js";
import {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
} from "../errors/foundation.js";
import { ProcessManagerService, ProcessManagerServiceLive } from "../ProcessManagerService.js";
import {
  RpcPortDiscoveryService,
  RpcPortDiscoveryServiceLive,
} from "../RpcPortDiscoveryService.js";
import { NodeReadinessService, NodeReadinessServiceLive } from "../NodeReadinessService.js";
import type { ProcessError } from "../errors.js";
import {
  withTimeout,
  foundationStartupTimeout,
  healthCheckTimeout,
  TimeoutDefaults,
  type OperationTimeoutError,
} from "../TimeoutPolicy.js";
import { withFoundationSpan } from "../Tracing.js";

const logger = createLogger({ name: "DevFoundationService" });

/**
 * Internal state for the DevFoundationService.
 *
 * This tracks the current status and running process information.
 */
interface DevFoundationState {
  readonly status: DevFoundationStatus;
  readonly runningInfo: DevFoundationRunningInfo | null;
  readonly cleanup: Effect.Effect<void, ProcessError> | null;
}

const initialState: DevFoundationState = {
  status: { _tag: "Stopped" },
  runningInfo: null,
  cleanup: null,
};

/**
 * Create the DevFoundationService implementation.
 *
 * This factory creates a service instance with its own state ref.
 * The service uses lower-level services (ProcessManager, RpcPortDiscovery, NodeReadiness)
 * to manage the node lifecycle.
 */
const makeDevFoundationService = Effect.gen(function* () {
  // Create a mutable ref to track state across method calls
  const stateRef = yield* Ref.make<DevFoundationState>(initialState);

  // Get dependencies
  const processManager = yield* ProcessManagerService;
  const rpcDiscovery = yield* RpcPortDiscoveryService;
  const nodeReadiness = yield* NodeReadinessService;

  /**
   * Start a dev foundation node.
   *
   * The entire startup process (launch + port discovery) is wrapped in a
   * configurable timeout. On timeout, the process is cleaned up and a
   * FoundationStartupError is returned.
   */
  const start = (
    config: DevFoundationConfig
  ): Effect.Effect<
    {
      readonly info: DevFoundationRunningInfo;
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
        cleanup: null,
      });

      logger.debug(`Starting dev foundation: ${config.name} with command: ${config.command}`);

      // Prepare args - add --rpc-port=0 if not present (let OS assign port)
      const nodeConfig = {
        isChopsticks: config.args.some((arg) => arg.includes("chopsticks.cjs")),
        hasRpcPort: config.args.some((arg) => arg.includes("--rpc-port")),
      };

      const finalArgs: readonly string[] =
        !nodeConfig.isChopsticks && !nodeConfig.hasRpcPort
          ? [
              ...config.args,
              // If MOONWALL_RPC_PORT was pre-allocated, respect it; otherwise fall back to 0
              process.env.MOONWALL_RPC_PORT
                ? `--rpc-port=${process.env.MOONWALL_RPC_PORT}`
                : "--rpc-port=0",
            ]
          : config.args;

      // Launch the process
      const { result: processResult, cleanup: processCleanup } = yield* processManager
        .launch({
          command: config.command,
          args: finalArgs,
          name: config.name,
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new FoundationStartupError({
                foundationType: "dev",
                message: `Failed to launch dev node "${config.name}": ${error.message || String(error)}`,
                cause: error,
              })
          )
        );

      const pid = processResult.process.pid;
      if (pid === undefined) {
        yield* Ref.set(stateRef, {
          status: { _tag: "Failed", error: new Error("Process PID is undefined") },
          runningInfo: null,
          cleanup: null,
        });
        return yield* Effect.fail(
          new FoundationStartupError({
            foundationType: "dev",
            message: `Process PID is undefined after launching "${config.name}"`,
          })
        );
      }

      logger.debug(`Process launched with PID: ${pid}, discovering RPC port...`);

      // Discover the RPC port
      const rpcPort = yield* rpcDiscovery
        .discoverRpcPort({
          pid,
          isEthereumChain: config.isEthereumChain,
          maxAttempts: 600, // 600 × 200ms = 120s timeout
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new FoundationStartupError({
                foundationType: "dev",
                message: `Failed to discover RPC port for "${config.name}" (PID: ${pid}): ${error.message || String(error)}`,
                cause: error,
              })
          )
        );

      logger.debug(`RPC port discovered: ${rpcPort} for ${config.name}`);

      // Build running info
      const runningInfo: DevFoundationRunningInfo = {
        process: processResult.process as ChildProcess,
        rpcPort,
        logPath: processResult.logPath,
        config,
      };

      // Update state to Running
      yield* Ref.set(stateRef, {
        status: { _tag: "Running", rpcPort, pid },
        runningInfo,
        cleanup: processCleanup,
      });

      logger.info(
        `Dev foundation "${config.name}" started successfully on port ${rpcPort} (PID: ${pid})`
      );

      // Create the stop effect for this specific node
      const stopEffect: Effect.Effect<void, FoundationShutdownError> = Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef);

        if (currentState.cleanup === null) {
          logger.warn(`Stop called but no cleanup function available for "${config.name}"`);
          return;
        }

        logger.debug(`Stopping dev foundation "${config.name}" (PID: ${pid})`);

        yield* currentState.cleanup.pipe(
          Effect.mapError(
            (error) =>
              new FoundationShutdownError({
                foundationType: "dev",
                message: `Failed to stop dev node "${config.name}": ${error.message || String(error)}`,
                cause: error,
                failedResources: pid ? [`PID:${pid}`] : undefined,
              })
          )
        );

        // Update state to Stopped
        yield* Ref.set(stateRef, {
          status: { _tag: "Stopped" },
          runningInfo: null,
          cleanup: null,
        });

        logger.info(`Dev foundation "${config.name}" stopped`);
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
            foundationType: "dev",
            message: (error as OperationTimeoutError).userMessage,
            cause: error,
          });
        }
        return error;
      }),
      // Add tracing span for observability
      withFoundationSpan("dev", "startup", config.name, {
        isEthereumChain: config.isEthereumChain,
      })
    );
  };

  /**
   * Stop the running dev foundation node.
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

      const nodeName = currentState.runningInfo?.config.name || "unknown";
      const pid = currentState.runningInfo?.process.pid;

      logger.debug(`Stopping dev foundation "${nodeName}"`);

      yield* currentState.cleanup.pipe(
        Effect.mapError(
          (error) =>
            new FoundationShutdownError({
              foundationType: "dev",
              message: `Failed to stop dev node "${nodeName}": ${error.message || String(error)}`,
              cause: error,
              failedResources: pid ? [`PID:${pid}`] : undefined,
            })
        )
      );

      // Update state to Stopped
      yield* Ref.set(stateRef, {
        status: { _tag: "Stopped" },
        runningInfo: null,
        cleanup: null,
      });

      logger.info(`Dev foundation "${nodeName}" stopped`);
    }).pipe(
      // Add tracing span for observability
      withFoundationSpan("dev", "shutdown", "dev-foundation")
    );

  /**
   * Get the current status of the dev foundation.
   */
  const getStatus = (): Effect.Effect<DevFoundationStatus> =>
    Ref.get(stateRef).pipe(Effect.map((state) => state.status));

  /**
   * Perform a health check on the running node.
   *
   * Includes a 30-second timeout to prevent hanging on unresponsive nodes.
   */
  const healthCheck = (): Effect.Effect<void, FoundationHealthCheckError> => {
    const healthCheckEffect = Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running") {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "dev",
            message: `Cannot health check: foundation is not running (status: ${currentState.status._tag})`,
          })
        );
      }

      const { rpcPort } = currentState.status;
      const isEthereumChain = currentState.runningInfo?.config.isEthereumChain ?? false;

      const isReady = yield* nodeReadiness
        .checkReady({
          port: rpcPort,
          isEthereumChain,
          maxAttempts: 10, // Shorter timeout for health check (10 × 50ms = 500ms with retries)
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new FoundationHealthCheckError({
                foundationType: "dev",
                message: `Health check failed for port ${rpcPort}: ${error.message || String(error)}`,
                endpoint: `ws://localhost:${rpcPort}`,
                cause: error,
              })
          )
        );

      if (!isReady) {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "dev",
            message: `Health check returned false for port ${rpcPort}`,
            endpoint: `ws://localhost:${rpcPort}`,
          })
        );
      }

      logger.debug(`Health check passed for port ${rpcPort}`);
    });

    return healthCheckEffect.pipe(
      (effect) => withTimeout(effect, healthCheckTimeout("dev foundation")),
      // Convert timeout error to FoundationHealthCheckError for consistent API
      Effect.mapError((error) => {
        if (error._tag === "OperationTimeoutError") {
          const timeoutError = error as OperationTimeoutError;
          return new FoundationHealthCheckError({
            foundationType: "dev",
            message: timeoutError.userMessage,
            endpoint: timeoutError.endpoint,
            cause: error,
          });
        }
        return error;
      }),
      // Add tracing span for observability
      withFoundationSpan("dev", "healthCheck", "dev-foundation")
    );
  };

  return {
    start,
    stop,
    getStatus,
    healthCheck,
  } satisfies Context.Tag.Service<DevFoundationService>;
});

// Need to import Context for the type
import type { Context } from "effect";

/**
 * Combined layer with all lower-level service dependencies.
 */
const DependenciesLive = Layer.mergeAll(
  ProcessManagerServiceLive,
  RpcPortDiscoveryServiceLive,
  NodeReadinessServiceLive
);

/**
 * Live implementation of DevFoundationService.
 *
 * This Layer provides a fully functional DevFoundationService that:
 * - Spawns blockchain node processes
 * - Discovers RPC ports automatically
 * - Performs WebSocket-based health checks
 * - Handles graceful shutdown
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { DevFoundationService, DevFoundationServiceLive } from "./services/index.js";
 *
 * const program = Effect.gen(function* () {
 *   const devFoundation = yield* DevFoundationService;
 *   const { info, stop } = yield* devFoundation.start(config);
 *   // ... use the node ...
 *   yield* stop;
 * }).pipe(Effect.provide(DevFoundationServiceLive));
 * ```
 */
export const DevFoundationServiceLive: Layer.Layer<DevFoundationService> = Layer.effect(
  DevFoundationService,
  makeDevFoundationService
).pipe(Layer.provide(DependenciesLive));

/**
 * Create a DevFoundationService layer with custom dependencies.
 *
 * This is useful for testing where you want to mock lower-level services.
 *
 * @param dependencies - Layer providing ProcessManagerService, RpcPortDiscoveryService, and NodeReadinessService
 * @returns Layer providing DevFoundationService
 */
export const makeDevFoundationServiceLayer = (
  dependencies: Layer.Layer<ProcessManagerService | RpcPortDiscoveryService | NodeReadinessService>
): Layer.Layer<DevFoundationService> =>
  Layer.effect(DevFoundationService, makeDevFoundationService).pipe(Layer.provide(dependencies));
