/**
 * Simplified Effect-based node launcher for integration with existing code
 */

import { Effect, Layer } from "effect";
import type { DevLaunchSpec } from "@moonwall/types";
import type { ChildProcess } from "node:child_process";
import { ProcessManagerService, ProcessManagerServiceLive } from "./ProcessManagerService.js";
import { PortDiscoveryService, PortDiscoveryServiceLive } from "./PortDiscoveryService.js";
import { NodeReadinessService, NodeReadinessServiceLive } from "./NodeReadinessService.js";
import { ProcessError } from "./errors.js";
import { createLogger } from "@moonwall/util";

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
  PortDiscoveryServiceLive,
  NodeReadinessServiceLive
);

/**
 * Launch a blockchain node with Effect-based lifecycle management
 *
 * This function provides automatic resource management:
 * - Process spawning with port 0 (OS assigns available port)
 * - Port discovery via lsof
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

  // Determine node type and port configuration (functional approach)
  const nodeConfig = {
    isChopsticks: config.args.some((arg) => arg.includes("chopsticks.cjs")),
    hasRpcPort: config.args.some((arg) => arg.includes("--rpc-port")),
    hasPort: config.args.some((arg) => arg.includes("--port")),
  };

  const finalArgs =
    !nodeConfig.isChopsticks && !nodeConfig.hasRpcPort
      ? [...config.args, "--rpc-port=0"] // Standard nodes use --rpc-port
      : config.args; // Chopsticks uses YAML config, or port already configured

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

          return PortDiscoveryService.pipe(
            Effect.flatMap((portDiscovery) =>
              Effect.sync(() =>
                logger.debug(`[T+${Date.now() - startTime}ms] Discovering port for PID ${pid}...`)
              ).pipe(Effect.flatMap(() => portDiscovery.discoverPort(pid)))
            ),
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
                  `[T+${Date.now() - startTime}ms] Discovered port: ${port}, isEthereumChain: ${config.isEthereumChain}, checking readiness...`
                )
              ).pipe(
                Effect.flatMap(() =>
                  NodeReadinessService.pipe(
                    Effect.flatMap((readiness) =>
                      readiness.checkReady({
                        port,
                        isEthereumChain: config.isEthereumChain,
                        maxAttempts: 15,
                      })
                    ),
                    Effect.mapError((error) => {
                      logger.error(`Readiness check failed: ${error}`);
                      return new ProcessError({
                        cause: error,
                        pid,
                        operation: "check",
                      });
                    }),
                    Effect.flatMap(() =>
                      Effect.sync(() =>
                        logger.debug(
                          `[T+${Date.now() - startTime}ms] Node ready! Returning result with manual cleanup function.`
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
                  )
                )
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
