import { type Context, Effect, Layer, Ref } from "effect";
import type { Network, LaunchConfig } from "@zombienet/orchestrator";
import zombie from "@zombienet/orchestrator";
import { createLogger } from "@moonwall/util";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as timer } from "node:timers/promises";
import { execSync } from "node:child_process";
import {
  ZombieFoundationService,
  ZombieNodeOperationError,
  type ZombieFoundationConfig,
  type ZombieFoundationRunningInfo,
  type ZombieFoundationStatus,
  type ZombieNodeInfo,
} from "./ZombieFoundationService.js";
import {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
} from "../errors/foundation.js";
import {
  checkZombieBins,
  getZombieConfig,
  type IPCRequestMessage,
  type IPCResponseMessage,
} from "../../foundations/zombieHelpers.js";

const logger = createLogger({ name: "ZombieFoundationService" });

/**
 * Internal state for the ZombieFoundationService.
 *
 * This tracks the current status, running network information, and cleanup resources.
 */
interface ZombieFoundationState {
  readonly status: ZombieFoundationStatus;
  readonly runningInfo: ZombieFoundationRunningInfo | null;
  readonly network: Network | null;
  readonly ipcServer: net.Server | null;
  readonly ipcSocketPath: string | null;
}

const initialState: ZombieFoundationState = {
  status: { _tag: "Stopped" },
  runningInfo: null,
  network: null,
  ipcServer: null,
  ipcSocketPath: null,
};

/**
 * Send an IPC message to the zombie network server.
 *
 * This wraps the low-level IPC communication in an Effect.
 */
const sendIpcMessageEffect = (
  socketPath: string,
  message: IPCRequestMessage
): Effect.Effect<IPCResponseMessage, ZombieNodeOperationError> =>
  Effect.tryPromise({
    try: () =>
      new Promise<IPCResponseMessage>(async (resolve, reject) => {
        const client = net.createConnection({ path: socketPath }, () => {
          logger.debug(`IPC client connected to ${socketPath}`);
        });

        client.on("error", (err) => {
          reject(
            new ZombieNodeOperationError(
              message.cmd as "restart" | "kill" | "pause" | "resume" | "isUp",
              message.nodeName || "unknown",
              `IPC connection error: ${err.message}`,
              err
            )
          );
        });

        client.on("data", async (data) => {
          const response = JSON.parse(data.toString()) as IPCResponseMessage;
          if (response.status === "success") {
            client.end();
            // Wait for client to close
            for (let i = 0; i < 100; i++) {
              if (client.closed) break;
              await timer(200);
            }
            resolve(response);
          } else {
            reject(
              new ZombieNodeOperationError(
                message.cmd as "restart" | "kill" | "pause" | "resume" | "isUp",
                message.nodeName || "unknown",
                response.message,
                response
              )
            );
          }
        });

        // Wait for connection to establish
        for (let i = 0; i < 100; i++) {
          if (!client.connecting) break;
          await timer(200);
        }

        client.write(JSON.stringify(message));
      }),
    catch: (error) => {
      if (error instanceof ZombieNodeOperationError) {
        return error;
      }
      return new ZombieNodeOperationError(
        message.cmd as "restart" | "kill" | "pause" | "resume" | "isUp",
        message.nodeName || "unknown",
        error instanceof Error ? error.message : String(error),
        error
      );
    },
  });

/**
 * Extract node information from a running zombie network.
 */
const extractNodeInfo = (network: Network): ReadonlyArray<ZombieNodeInfo> => {
  const nodes: ZombieNodeInfo[] = [];

  // Add relay chain nodes
  for (const relayNode of network.relay) {
    nodes.push({
      name: relayNode.name,
      type: "relaychain",
      wsEndpoint: relayNode.wsUri,
      multiAddress: relayNode.multiAddress,
    });
  }

  // Add parachain nodes
  for (const [paraId, parachain] of Object.entries(network.paras)) {
    for (const paraNode of parachain.nodes) {
      nodes.push({
        name: paraNode.name,
        type: "parachain",
        wsEndpoint: paraNode.wsUri,
        multiAddress: paraNode.multiAddress,
        parachainId: Number(paraId),
      });
    }
  }

  return nodes;
};

/**
 * Create the ZombieFoundationService implementation.
 *
 * This factory creates a service instance with its own state ref.
 * The service wraps @zombienet/orchestrator to manage multi-node
 * blockchain networks for testing.
 */
const makeZombieFoundationService = Effect.gen(function* () {
  // Create a mutable ref to track state across method calls
  const stateRef = yield* Ref.make<ZombieFoundationState>(initialState);

  /**
   * Start a Zombienet multi-node network.
   */
  const start = (
    config: ZombieFoundationConfig
  ): Effect.Effect<
    {
      readonly info: ZombieFoundationRunningInfo;
      readonly stop: Effect.Effect<void, FoundationShutdownError>;
    },
    FoundationStartupError
  > =>
    Effect.gen(function* () {
      // Update status to Starting
      yield* Ref.set(stateRef, {
        ...initialState,
        status: { _tag: "Starting" },
      });

      logger.debug(`Starting zombie foundation: ${config.name} from config: ${config.configPath}`);

      // Load and validate zombienet configuration
      let zombieConfig: LaunchConfig;
      try {
        zombieConfig = getZombieConfig(config.configPath);
      } catch (error) {
        yield* Ref.set(stateRef, {
          ...initialState,
          status: { _tag: "Failed", error },
        });
        return yield* Effect.fail(
          new FoundationStartupError({
            foundationType: "zombie",
            message: `Failed to load zombie config from "${config.configPath}": ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          })
        );
      }

      // Verify binaries exist and are accessible
      yield* Effect.tryPromise({
        try: () => checkZombieBins(zombieConfig),
        catch: (error) =>
          new FoundationStartupError({
            foundationType: "zombie",
            message: `Binary check failed for zombie network "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          }),
      });

      logger.debug(`Starting zombienet orchestrator for ${config.name}...`);

      // Launch the zombie network
      let network: Network;
      try {
        network = yield* Effect.tryPromise({
          try: () => zombie.start("", zombieConfig, { logType: "silent" }),
          catch: (error) =>
            new FoundationStartupError({
              foundationType: "zombie",
              message: `Failed to start zombie network "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
              cause: error,
            }),
        });
      } catch (error) {
        yield* Ref.set(stateRef, {
          ...initialState,
          status: {
            _tag: "Failed",
            error: error instanceof Error ? error : new Error(String(error)),
          },
        });
        return yield* Effect.fail(
          error instanceof FoundationStartupError
            ? error
            : new FoundationStartupError({
                foundationType: "zombie",
                message: `Failed to start zombie network "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
                cause: error,
              })
        );
      }

      const relayWsEndpoint = network.relay[0]?.wsUri || "";
      const paraWsEndpoint =
        Object.values(network.paras).length > 0
          ? Object.values(network.paras)[0].nodes[0]?.wsUri
          : undefined;

      const nodes = extractNodeInfo(network);

      logger.debug(`Zombie network ${config.name} started with ${nodes.length} nodes`);

      // Set up IPC server for node operations
      const socketPath = path.join(network.tmpDir, "node-ipc.sock");

      // Remove existing socket file if it exists
      if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
        logger.debug(`Removed existing socket at ${socketPath}`);
      }

      const ipcLogPath = path.join(network.tmpDir, "ipc-server.log");
      const ipcLogger = fs.createWriteStream(ipcLogPath, { flags: "a" });

      const logIpc = (message: string) => {
        const timestamp = new Date().toISOString();
        ipcLogger.write(`${timestamp} - ${message}\n`);
      };

      const server = net.createServer((client) => {
        logIpc("IPC client connected");

        client.on("data", async (data) => {
          const writeToClient = (message: IPCResponseMessage) => {
            if (client.writable) {
              client.write(JSON.stringify(message));
            }
          };

          try {
            const message: IPCRequestMessage = JSON.parse(data.toString());

            switch (message.cmd) {
              case "networkmap": {
                const result = Object.keys(network.nodesByName);
                writeToClient({
                  status: "success",
                  result: network.nodesByName,
                  message: result.join("|"),
                });
                break;
              }

              case "restart": {
                if (!message.nodeName) {
                  writeToClient({
                    status: "failure",
                    result: false,
                    message: "nodeName required for restart",
                  });
                  break;
                }
                logIpc(`Restarting node: ${message.nodeName}`);
                await (network.client as any).restartNode(message.nodeName, 5);
                await timer(5000); // Wait for node to come back up
                writeToClient({
                  status: "success",
                  result: true,
                  message: `${message.nodeName} restarted`,
                });
                break;
              }

              case "pause": {
                if (!message.nodeName) {
                  writeToClient({
                    status: "failure",
                    result: false,
                    message: "nodeName required for pause",
                  });
                  break;
                }
                const pauseNode = network.getNodeByName(message.nodeName);
                const pauseResult = await pauseNode.pause();
                await timer(1000);
                writeToClient({
                  status: "success",
                  result: pauseResult,
                  message: `${message.nodeName} paused`,
                });
                break;
              }

              case "resume": {
                if (!message.nodeName) {
                  writeToClient({
                    status: "failure",
                    result: false,
                    message: "nodeName required for resume",
                  });
                  break;
                }
                const resumeNode = network.getNodeByName(message.nodeName);
                const resumeResult = await resumeNode.resume();
                await (network.client as any).wait_node_ready(message.nodeName);
                writeToClient({
                  status: "success",
                  result: resumeResult,
                  message: `${message.nodeName} resumed`,
                });
                break;
              }

              case "kill": {
                if (!message.nodeName) {
                  writeToClient({
                    status: "failure",
                    result: false,
                    message: "nodeName required for kill",
                  });
                  break;
                }
                const pid = (network.client as any).processMap[message.nodeName]?.pid;
                if (pid) {
                  delete (network.client as any).processMap[message.nodeName];
                  try {
                    execSync(`kill ${pid}`, { stdio: "ignore" });
                  } catch {
                    // Process may already be dead
                  }
                }
                writeToClient({
                  status: "success",
                  result: true,
                  message: `${message.nodeName} killed`,
                });
                break;
              }

              case "isup": {
                if (!message.nodeName) {
                  writeToClient({
                    status: "failure",
                    result: false,
                    message: "nodeName required for isup",
                  });
                  break;
                }
                const isUpNode = network.getNodeByName(message.nodeName);
                const isUpResult = await isUpNode.isUp();
                writeToClient({
                  status: "success",
                  result: isUpResult,
                  message: `${message.nodeName} isUp: ${isUpResult}`,
                });
                break;
              }

              default:
                writeToClient({
                  status: "failure",
                  result: false,
                  message: `Unknown command: ${message.cmd}`,
                });
            }
          } catch (e: any) {
            logIpc(`Error processing message: ${e.message}`);
            writeToClient({
              status: "failure",
              result: false,
              message: e.message,
            });
          }
        });

        client.on("error", (err) => {
          logIpc(`IPC client error: ${err.message}`);
        });

        client.on("close", () => {
          logIpc("IPC client disconnected");
        });
      });

      server.on("error", (err) => {
        logger.error(`IPC Server error: ${err.message}`);
      });

      server.listen(socketPath, () => {
        logIpc(`IPC Server listening on ${socketPath}`);
        try {
          fs.chmodSync(socketPath, 0o600);
        } catch (err) {
          logger.error(`Error setting socket permissions: ${err}`);
        }
      });

      // Build running info
      const runningInfo: ZombieFoundationRunningInfo = {
        relayWsEndpoint,
        paraWsEndpoint,
        tempDir: network.tmpDir,
        nodes,
        config,
      };

      // Update state to Running
      yield* Ref.set(stateRef, {
        status: {
          _tag: "Running",
          relayWsEndpoint,
          paraWsEndpoint,
          nodeCount: nodes.length,
        },
        runningInfo,
        network,
        ipcServer: server,
        ipcSocketPath: socketPath,
      });

      logger.info(
        `Zombie foundation "${config.name}" started successfully with ${nodes.length} nodes`
      );
      logger.info(`  Relay: ${relayWsEndpoint}`);
      if (paraWsEndpoint) {
        logger.info(`  Para: ${paraWsEndpoint}`);
      }

      // Create the stop effect for this specific network
      const stopEffect: Effect.Effect<void, FoundationShutdownError> = Effect.gen(function* () {
        const currentState = yield* Ref.get(stateRef);

        if (currentState.network === null) {
          logger.warn(`Stop called but no network available for "${config.name}"`);
          return;
        }

        logger.debug(`Stopping zombie foundation "${config.name}"`);

        // Close IPC server
        if (currentState.ipcServer) {
          currentState.ipcServer.close(() => {
            logger.debug("IPC Server closed");
          });
          currentState.ipcServer.removeAllListeners();
        }

        // Stop the zombie network
        yield* Effect.tryPromise({
          try: async () => {
            await currentState.network?.stop();

            // Kill any remaining processes
            const processMap = (currentState.network?.client as any).processMap;
            const processIds = Object.values(processMap)
              .filter((item: any) => item?.pid)
              .map((process: any) => process.pid);

            if (processIds.length > 0) {
              try {
                execSync(`kill ${processIds.join(" ")}`, { stdio: "ignore" });
              } catch {
                // Processes may already be dead
              }
            }
          },
          catch: (error) =>
            new FoundationShutdownError({
              foundationType: "zombie",
              message: `Failed to stop zombie network "${config.name}": ${error instanceof Error ? error.message : String(error)}`,
              cause: error,
            }),
        });

        // Update state to Stopped
        yield* Ref.set(stateRef, {
          status: { _tag: "Stopped" },
          runningInfo: null,
          network: null,
          ipcServer: null,
          ipcSocketPath: null,
        });

        logger.info(`Zombie foundation "${config.name}" stopped`);
      });

      return {
        info: runningInfo,
        stop: stopEffect,
      };
    });

  /**
   * Stop the running zombie network.
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

      if (currentState.network === null) {
        logger.warn("Stop called but no network available");
        return;
      }

      const networkName = currentState.runningInfo?.config.name || "unknown";

      logger.debug(`Stopping zombie foundation "${networkName}"`);

      // Close IPC server
      if (currentState.ipcServer) {
        currentState.ipcServer.close(() => {
          logger.debug("IPC Server closed");
        });
        currentState.ipcServer.removeAllListeners();
      }

      // Stop the zombie network
      yield* Effect.tryPromise({
        try: async () => {
          await currentState.network?.stop();

          // Kill any remaining processes
          const processMap = (currentState.network?.client as any).processMap;
          const processIds = Object.values(processMap)
            .filter((item: any) => item?.pid)
            .map((process: any) => process.pid);

          if (processIds.length > 0) {
            try {
              execSync(`kill ${processIds.join(" ")}`, { stdio: "ignore" });
            } catch {
              // Processes may already be dead
            }
          }
        },
        catch: (error) =>
          new FoundationShutdownError({
            foundationType: "zombie",
            message: `Failed to stop zombie network "${networkName}": ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          }),
      });

      // Update state to Stopped
      yield* Ref.set(stateRef, {
        status: { _tag: "Stopped" },
        runningInfo: null,
        network: null,
        ipcServer: null,
        ipcSocketPath: null,
      });

      logger.info(`Zombie foundation "${networkName}" stopped`);
    });

  /**
   * Get the current status of the zombie foundation.
   */
  const getStatus = (): Effect.Effect<ZombieFoundationStatus> =>
    Ref.get(stateRef).pipe(Effect.map((state) => state.status));

  /**
   * Perform a health check on the running network.
   *
   * Checks that at least one relay node is responsive via RPC.
   */
  const healthCheck = (): Effect.Effect<void, FoundationHealthCheckError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running") {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "zombie",
            message: `Cannot health check: foundation is not running (status: ${currentState.status._tag})`,
          })
        );
      }

      if (currentState.network === null) {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "zombie",
            message: "Cannot health check: no network available",
          })
        );
      }

      const { relayWsEndpoint } = currentState.status;

      // Check if relay node is responsive
      const relayNode = currentState.network.relay[0];
      if (!relayNode) {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "zombie",
            message: "No relay node found in network",
          })
        );
      }

      const isUp = yield* Effect.tryPromise({
        try: () => relayNode.isUp(),
        catch: (error) =>
          new FoundationHealthCheckError({
            foundationType: "zombie",
            message: `Health check failed for relay node: ${error instanceof Error ? error.message : String(error)}`,
            endpoint: relayWsEndpoint,
            cause: error,
          }),
      });

      if (!isUp) {
        return yield* Effect.fail(
          new FoundationHealthCheckError({
            foundationType: "zombie",
            message: `Relay node is not up at ${relayWsEndpoint}`,
            endpoint: relayWsEndpoint,
          })
        );
      }

      logger.debug(`Health check passed for zombie network (relay: ${relayWsEndpoint})`);
    });

  /**
   * Get information about all running nodes in the network.
   */
  const getNodes = (): Effect.Effect<ReadonlyArray<ZombieNodeInfo>> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.runningInfo === null) {
        return [];
      }

      return currentState.runningInfo.nodes;
    });

  /**
   * Restart a specific node in the network.
   */
  const restartNode = (nodeName: string): Effect.Effect<void, ZombieNodeOperationError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running" || currentState.ipcSocketPath === null) {
        return yield* Effect.fail(
          new ZombieNodeOperationError(
            "restart",
            nodeName,
            "Cannot restart node: network is not running"
          )
        );
      }

      yield* sendIpcMessageEffect(currentState.ipcSocketPath, {
        text: `Restarting node ${nodeName}`,
        cmd: "restart",
        nodeName,
      });

      logger.info(`Node "${nodeName}" restarted`);
    });

  /**
   * Kill (terminate) a specific node in the network.
   */
  const killNode = (nodeName: string): Effect.Effect<void, ZombieNodeOperationError> =>
    Effect.gen(function* () {
      const currentState = yield* Ref.get(stateRef);

      if (currentState.status._tag !== "Running" || currentState.ipcSocketPath === null) {
        return yield* Effect.fail(
          new ZombieNodeOperationError("kill", nodeName, "Cannot kill node: network is not running")
        );
      }

      yield* sendIpcMessageEffect(currentState.ipcSocketPath, {
        text: `Killing node ${nodeName}`,
        cmd: "kill",
        nodeName,
      });

      logger.info(`Node "${nodeName}" killed`);
    });

  return {
    start,
    stop,
    getStatus,
    healthCheck,
    getNodes,
    restartNode,
    killNode,
  } satisfies Context.Tag.Service<ZombieFoundationService>;
});

/**
 * Live implementation of ZombieFoundationService.
 *
 * This Layer provides a fully functional ZombieFoundationService that:
 * - Launches multi-node blockchain networks via @zombienet/orchestrator
 * - Manages node lifecycle (start, stop, restart, kill)
 * - Provides health checks via node RPC endpoints
 * - Handles graceful shutdown with cleanup of all processes
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { ZombieFoundationService, ZombieFoundationServiceLive } from "./services/index.js";
 *
 * const program = Effect.gen(function* () {
 *   const zombie = yield* ZombieFoundationService;
 *   const { info, stop } = yield* zombie.start({
 *     configPath: "./zombienet.json",
 *     name: "test-network",
 *     launchSpec: spec,
 *   });
 *   console.log(`Relay at ${info.relayWsEndpoint}`);
 *   console.log(`Running ${info.nodes.length} nodes`);
 *
 *   // Get node information
 *   const nodes = yield* zombie.getNodes();
 *
 *   // Restart a node for testing
 *   yield* zombie.restartNode("alice");
 *
 *   yield* stop;
 * }).pipe(Effect.provide(ZombieFoundationServiceLive));
 * ```
 */
export const ZombieFoundationServiceLive: Layer.Layer<ZombieFoundationService> = Layer.effect(
  ZombieFoundationService,
  makeZombieFoundationService
);

/**
 * Create a ZombieFoundationService layer for testing.
 *
 * Since ZombieFoundationService doesn't have injectable dependencies
 * (it uses @zombienet/orchestrator directly), this is mainly useful for
 * creating isolated instances in tests.
 *
 * For mocking in tests, use Layer.succeed to provide a mock implementation
 * of the ZombieFoundationService interface directly.
 *
 * @returns Layer providing ZombieFoundationService
 */
export const makeZombieFoundationServiceLayer = (): Layer.Layer<ZombieFoundationService> =>
  Layer.effect(ZombieFoundationService, makeZombieFoundationService);
