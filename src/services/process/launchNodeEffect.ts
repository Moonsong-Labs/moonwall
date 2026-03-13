/**
 * Simplified Effect-based node launcher for integration with existing code
 */

import { Effect, Layer } from "effect";
import type { DevLaunchSpec } from "../../api/types/index.js";
import type { ChildProcess } from "node:child_process";
import { ProcessManagerService, ProcessManagerServiceLive } from "./ProcessManagerService.js";
import {
  RpcPortDiscoveryService,
  RpcPortDiscoveryServiceLive,
} from "../network/RpcPortDiscoveryService.js";
import { NodeReadinessService, NodeReadinessServiceLive } from "../network/NodeReadinessService.js";
import { ProcessError } from "../errors.js";
import { createLogger } from "../../internal/logger.js";

const logger = createLogger({ name: "launchNodeEffect" });
const debug = logger.debug.bind(logger);

/**
 * Configuration for launching a node
 */
export interface LaunchNodeConfig {
  readonly command: string;
  readonly args: string[];
  readonly name: string;
  readonly launchSpec?: DevLaunchSpec;
  readonly isEthereumChain: boolean;
}

/**
 * Result from launching a node
 */
export interface LaunchNodeResult {
  readonly runningNode: ChildProcess;
  readonly port: number;
  readonly logPath: string;
}

/**
 * Combined layer with all dependencies
 */
const AllServicesLive = Layer.mergeAll(
  ProcessManagerServiceLive,
  RpcPortDiscoveryServiceLive,
  NodeReadinessServiceLive
);

const parseExplicitRpcPort = (args: readonly string[]): number | undefined => {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg.startsWith("--rpc-port=")) {
      const port = Number.parseInt(arg.slice("--rpc-port=".length), 10);
      return Number.isFinite(port) && port > 0 ? port : undefined;
    }

    if (arg === "--rpc-port") {
      const next = args[index + 1];
      const port = Number.parseInt(next ?? "", 10);
      return Number.isFinite(port) && port > 0 ? port : undefined;
    }
  }

  return undefined;
};

const resolveRpcPort = (
  pid: number,
  knownRpcPort: number | undefined,
  config: LaunchNodeConfig,
  startTime: number
) => {
  if (knownRpcPort !== undefined) {
    return NodeReadinessService.pipe(
      Effect.flatMap((readiness) =>
        Effect.sync(() =>
          logger.debug(
            `[T+${Date.now() - startTime}ms] Using explicit RPC port ${knownRpcPort}; skipping lsof discovery`
          )
        ).pipe(
          Effect.flatMap(() =>
            readiness.checkReady({
              port: knownRpcPort,
              isEthereumChain: config.isEthereumChain,
              maxAttempts: 600,
            })
          ),
          Effect.as(knownRpcPort)
        )
      )
    );
  }

  return RpcPortDiscoveryService.pipe(
    Effect.flatMap((rpcDiscovery) =>
      Effect.sync(() =>
        logger.debug(`[T+${Date.now() - startTime}ms] Discovering RPC port for PID ${pid}...`)
      ).pipe(
        Effect.flatMap(() =>
          rpcDiscovery.discoverRpcPort({
            pid,
            isEthereumChain: config.isEthereumChain,
            maxAttempts: 600,
          })
        )
      )
    )
  );
};

/**
 * Launch a blockchain node with Effect-based lifecycle management
 *
 * This function provides automatic resource management:
 * - Process spawning with port 0 (OS assigns available port)
 * - Port discovery via lsof when the RPC port is not already known
 * - WebSocket readiness check
 * - Automatic cleanup on scope closure
 *
 * @param config Node launch configuration
 * @returns Promise resolving to node info and cleanup function
 */
export async function launchNodeEffect(
  config: LaunchNodeConfig
): Promise<{ result: LaunchNodeResult; cleanup: () => Promise<void> }> {
  const startTime = Date.now();
  logger.debug(`[T+0ms] Starting with command: ${config.command}, name: ${config.name}`);

  const nodeConfig = {
    isChopsticks: config.args.some((arg) => arg.includes("chopsticks.cjs")),
    hasRpcPort: config.args.some((arg) => arg.includes("--rpc-port")),
  };

  const finalArgs =
    !nodeConfig.isChopsticks && !nodeConfig.hasRpcPort
      ? [
          ...config.args,
          // If MOONWALL_RPC_PORT was pre-allocated by LaunchCommandParser, respect it; otherwise fall back to 0.
          process.env.MOONWALL_RPC_PORT
            ? `--rpc-port=${process.env.MOONWALL_RPC_PORT}`
            : "--rpc-port=0",
        ]
      : config.args; // Chopsticks uses YAML config, or port already configured

  const knownRpcPort = parseExplicitRpcPort(finalArgs);
  debug(`Final args: ${JSON.stringify(finalArgs)}`);

  const program = ProcessManagerService.pipe(
    Effect.flatMap((processManager) =>
      Effect.sync(() => logger.debug(`[T+${Date.now() - startTime}ms] Launching process...`)).pipe(
        Effect.flatMap(() =>
          processManager.launch({
            command: config.command,
            args: finalArgs,
            name: config.name,
          })
        )
      )
    ),
    Effect.flatMap(({ result: processResult, cleanup: processCleanup }) =>
      Effect.sync(() =>
        logger.debug(
          `[T+${Date.now() - startTime}ms] Process launched with PID: ${processResult.process.pid}`
        )
      ).pipe(
        Effect.flatMap(() => {
          const pid = processResult.process.pid;
          if (pid === undefined) {
            return Effect.fail(
              new ProcessError({
                cause: new Error("Process PID is undefined after launch"),
                operation: "check",
              })
            );
          }

          return resolveRpcPort(pid, knownRpcPort, config, startTime).pipe(
            Effect.mapError(
              (error) =>
                new ProcessError({
                  cause: error,
                  pid,
                  operation: "check",
                })
            ),
            Effect.flatMap((port) =>
              Effect.sync(() =>
                logger.debug(
                  knownRpcPort !== undefined
                    ? `[T+${Date.now() - startTime}ms] Explicit RPC port is ready: ${port}`
                    : `[T+${Date.now() - startTime}ms] Discovered and validated RPC port: ${port}`
                )
              ).pipe(
                Effect.map(() => ({
                  processInfo: {
                    process: processResult.process,
                    port,
                    logPath: processResult.logPath,
                  },
                  cleanup: processCleanup,
                }))
              )
            )
          );
        })
      )
    )
  ).pipe(Effect.provide(AllServicesLive));

  // Run without Scope - cleanup is returned as a function
  // We can't simply use scopes because:
  //   1) when this effect is run in beforeAll() hook, we want the node to persist during test
  //   2) If we hoist scope to outside, we accidentally spawn it when describe block is processed during test collection
  return Effect.runPromise(
    Effect.map(program, ({ processInfo, cleanup }) => ({
      result: {
        runningNode: processInfo.process as ChildProcess,
        port: processInfo.port,
        logPath: processInfo.logPath,
      },
      cleanup: () => Effect.runPromise(cleanup),
    }))
  );
}
