import { createLogger } from "@moonwall/util";
import { Context, Effect, Layer, Schedule } from "effect";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { WebSocket } from "ws";
import { PortDiscoveryError } from "./errors.js";

const execAsync = promisify(exec);
const logger = createLogger({ name: "RpcPortDiscoveryService" });
const debug = logger.debug.bind(logger);

/**
 * Service for discovering RPC ports by testing actual connectivity
 */
export class RpcPortDiscoveryService extends Context.Tag("RpcPortDiscoveryService")<
  RpcPortDiscoveryService,
  {
    /**
     * Discover RPC port by testing actual RPC connectivity on all candidate ports
     * @param config Discovery configuration
     * @returns First port that responds to RPC calls
     */
    readonly discoverRpcPort: (config: {
      pid: number;
      isEthereumChain: boolean;
      maxAttempts?: number;
    }) => Effect.Effect<number, PortDiscoveryError>;
  }
>() {}

/**
 * Parse ports from lsof output
 */
const parsePortsFromLsof = (stdout: string): number[] => {
  const ports: number[] = [];
  const lines = stdout.split("\n");

  for (const line of lines) {
    const regex = /(?:.+):(\d+)/;
    const match = line.match(regex);
    if (match) {
      ports.push(Number.parseInt(match[1], 10));
    }
  }

  return ports;
};

/**
 * Get all listening ports for a process
 */
const getAllPorts = (pid: number): Effect.Effect<number[], PortDiscoveryError> =>
  Effect.tryPromise({
    try: () => execAsync(`lsof -p ${pid} -n -P | grep LISTEN`),
    catch: (cause) =>
      new PortDiscoveryError({
        cause,
        pid,
        attempts: 1,
      }),
  }).pipe(
    Effect.map(({ stdout }) => parsePortsFromLsof(stdout)),
    Effect.flatMap((ports) =>
      ports.length === 0
        ? Effect.fail(
            new PortDiscoveryError({
              cause: new Error("No listening ports found"),
              pid,
              attempts: 1,
            })
          )
        : Effect.succeed(ports)
    )
  );

/**
 * Test if a port responds to RPC calls
 *
 * CRITICAL RESOURCE MANAGEMENT:
 * - Effect.async cleanup is ONLY invoked on interruption (Effect.raceAll cancellation)
 * - Normal completion (success/error) requires manual cleanup
 * - Separate cleanedUp flag prevents double cleanup
 */
const testRpcPort = (
  port: number,
  isEthereumChain: boolean
): Effect.Effect<number, PortDiscoveryError> =>
  Effect.async<number, PortDiscoveryError>((resume) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    let resolved = false;
    let cleanedUp = false;

    const cleanup = () => {
      if (!cleanedUp) {
        cleanedUp = true;
        try {
          ws.close();
        } catch (_e) {
          // Ignore cleanup errors
        }
      }
    };

    const testMethod = (method: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.removeListener("message", messageHandler);
          resolve(false);
        }, 3000);

        ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: Math.floor(Math.random() * 10000),
            method,
            params: [],
          })
        );

        const messageHandler = (data: Buffer) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.jsonrpc === "2.0" && !response.error) {
              clearTimeout(timeout);
              ws.removeListener("message", messageHandler);
              resolve(true);
            }
          } catch (_e) {
            clearTimeout(timeout);
            ws.removeListener("message", messageHandler);
            resolve(false);
          }
        };

        ws.on("message", messageHandler);
      });
    };

    ws.on("open", async () => {
      try {
        // Check if already cleaned up (Effect was cancelled)
        if (cleanedUp) return;

        // Test system_chain first (works for all chains)
        const systemChainOk = await testMethod("system_chain");
        if (cleanedUp) return; // Check again after async operation

        if (systemChainOk && !resolved) {
          resolved = true;
          debug(`Port ${port} responded to system_chain`);
          resume(Effect.succeed(port));
          cleanup(); // Cleanup AFTER resume
          return;
        }

        // If Ethereum chain, also try eth_chainId
        if (isEthereumChain) {
          if (cleanedUp) return; // Check before next async operation

          const ethOk = await testMethod("eth_chainId");
          if (cleanedUp) return; // Check again after async operation

          if (ethOk && !resolved) {
            resolved = true;
            debug(`Port ${port} responded to eth_chainId`);
            resume(Effect.succeed(port));
            cleanup(); // Cleanup AFTER resume
            return;
          }
        }

        // No valid response
        if (!resolved && !cleanedUp) {
          resolved = true;
          resume(
            Effect.fail(
              new PortDiscoveryError({
                cause: new Error(`Port ${port} did not respond to RPC methods`),
                pid: 0,
                attempts: 1,
              })
            )
          );
          cleanup(); // Cleanup AFTER resume
        }
      } catch (error) {
        if (!resolved && !cleanedUp) {
          resolved = true;
          resume(
            Effect.fail(
              new PortDiscoveryError({
                cause: error,
                pid: 0,
                attempts: 1,
              })
            )
          );
          cleanup(); // Cleanup AFTER resume
        }
      }
    });

    ws.on("error", (error) => {
      if (!resolved) {
        resolved = true;
        resume(
          Effect.fail(
            new PortDiscoveryError({
              cause: error,
              pid: 0,
              attempts: 1,
            })
          )
        );
        cleanup(); // Cleanup AFTER resume
      }
    });

    // Overall timeout (7s = 2×3s testMethod timeouts + 1s buffer)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resume(
          Effect.fail(
            new PortDiscoveryError({
              cause: new Error(`Port ${port} connection timeout`),
              pid: 0,
              attempts: 1,
            })
          )
        );
        cleanup(); // Cleanup AFTER resume
      }
    }, 7000);

    // CRITICAL: Return cleanup for interruption path (Effect.raceAll cancellation)
    // This ensures losing ports in the race are properly cleaned up
    return Effect.sync(cleanup);
  });

/**
 * Discover RPC port by racing tests on all candidate ports
 */
const discoverRpcPortWithRace = (config: {
  pid: number;
  isEthereumChain: boolean;
  maxAttempts?: number;
}): Effect.Effect<number, PortDiscoveryError> => {
  const maxAttempts = config.maxAttempts || 600; // Match PortDiscoveryService: 600 attempts × 200ms = 120s

  return getAllPorts(config.pid).pipe(
    Effect.flatMap((allPorts) => {
      debug(`Discovered ports: ${allPorts.join(", ")}`);

      // Filter to reasonable candidates (non-privileged ports, exclude p2p port)
      const candidatePorts = allPorts.filter(
        (p) => p >= 1024 && p <= 65535 && p !== 30333 // Exclude p2p port
      );

      if (candidatePorts.length === 0) {
        return Effect.fail(
          new PortDiscoveryError({
            cause: new Error(`No candidate RPC ports found in: ${allPorts.join(", ")}`),
            pid: config.pid,
            attempts: 1,
          })
        );
      }

      debug(`Testing candidate ports: ${candidatePorts.join(", ")}`);

      // Race all port tests - first one to respond wins
      return Effect.raceAll(
        candidatePorts.map((port) => testRpcPort(port, config.isEthereumChain))
      ).pipe(
        Effect.catchAll((_error) =>
          Effect.fail(
            new PortDiscoveryError({
              cause: new Error(
                `All candidate ports failed RPC test: ${candidatePorts.join(", ")}`
              ),
              pid: config.pid,
              attempts: 1,
            })
          )
        )
      );
    }),
    // Retry the entire discovery process
    Effect.retry(
      Schedule.fixed("200 millis").pipe(Schedule.compose(Schedule.recurs(maxAttempts - 1)))
    ),
    Effect.catchAll((error) =>
      Effect.fail(
        new PortDiscoveryError({
          cause: error,
          pid: config.pid,
          attempts: maxAttempts,
        })
      )
    )
  );
};

/**
 * Live implementation of RpcPortDiscoveryService
 */
export const RpcPortDiscoveryServiceLive = Layer.succeed(RpcPortDiscoveryService, {
  discoverRpcPort: discoverRpcPortWithRace,
});
