import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createLogger } from "@moonwall/util";
import { Context, Effect, Layer, Option, Schedule } from "effect";
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
  const regex = /(?:.+):(\d+)/;
  return stdout.split("\n").flatMap((line) => {
    const match = line.match(regex);
    return match ? [Number.parseInt(match[1], 10)] : [];
  });
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
 * Acquire a WebSocket connection as a managed resource
 */
const acquireWebSocket = (port: number): Effect.Effect<WebSocket, PortDiscoveryError> =>
  Effect.async<WebSocket, PortDiscoveryError>((resume) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    const handleOpen = () => {
      ws.removeListener("error", handleError);
      resume(Effect.succeed(ws));
    };

    const handleError = (error: Error) => {
      ws.removeListener("open", handleOpen);
      resume(
        Effect.fail(
          new PortDiscoveryError({
            cause: error,
            pid: 0,
            attempts: 1,
          })
        )
      );
    };

    ws.once("open", handleOpen);
    ws.once("error", handleError);

    return Effect.sync(() => {
      ws.removeListener("open", handleOpen);
      ws.removeListener("error", handleError);
      try {
        ws.close();
      } catch (_e) {
        // Ignore cleanup errors
      }
    });
  });

/**
 * Test a single RPC method on an open WebSocket
 */
const testRpcMethod = (ws: WebSocket, method: string): Effect.Effect<boolean> =>
  Effect.async<boolean>((resume) => {
    const handleMessage = (data: Buffer) => {
      ws.removeListener("message", handleMessage);
      try {
        const response = JSON.parse(data.toString());
        resume(Effect.succeed(response.jsonrpc === "2.0" && !response.error));
      } catch (_e) {
        resume(Effect.succeed(false));
      }
    };

    ws.on("message", handleMessage);

    try {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Math.floor(Math.random() * 10000),
          method,
          params: [],
        })
      );
    } catch (_error) {
      ws.removeListener("message", handleMessage);
      resume(Effect.succeed(false));
    }

    return Effect.sync(() => {
      ws.removeListener("message", handleMessage);
    });
  }).pipe(Effect.timeoutOption("3 seconds"), Effect.map(Option.getOrElse(() => false)));

/**
 * Test if a port responds to RPC calls using Effect primitives
 */
const testRpcPort = (
  port: number,
  isEthereumChain: boolean
): Effect.Effect<number, PortDiscoveryError> =>
  Effect.acquireUseRelease(
    acquireWebSocket(port),
    (ws) => {
      const systemChainTest = testRpcMethod(ws, "system_chain").pipe(
        Effect.flatMap((success) =>
          success
            ? Effect.sync(() => {
                debug(`Port ${port} responded to system_chain`);
                return port;
              })
            : Effect.fail(
                new PortDiscoveryError({
                  cause: new Error(`Port ${port} did not respond to system_chain`),
                  pid: 0,
                  attempts: 1,
                })
              )
        )
      );

      if (!isEthereumChain) {
        return systemChainTest;
      }

      const ethChainTest = testRpcMethod(ws, "eth_chainId").pipe(
        Effect.flatMap((success) =>
          success
            ? Effect.sync(() => {
                debug(`Port ${port} responded to eth_chainId`);
                return port;
              })
            : Effect.fail(
                new PortDiscoveryError({
                  cause: new Error(`Port ${port} did not respond to eth_chainId`),
                  pid: 0,
                  attempts: 1,
                })
              )
        )
      );

      return Effect.race(systemChainTest, ethChainTest);
    },
    (ws) =>
      Effect.sync(() => {
        try {
          ws.close();
        } catch (_e) {
          // Ignore cleanup errors
        }
      })
  ).pipe(
    Effect.timeoutOption("7 seconds"),
    Effect.flatMap((opt) =>
      Option.match(opt, {
        onNone: () =>
          Effect.fail(
            new PortDiscoveryError({
              cause: new Error(`Port ${port} connection timeout`),
              pid: 0,
              attempts: 1,
            })
          ),
        onSome: (val) => Effect.succeed(val),
      })
    )
  );

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
        (p) => p >= 1024 && p <= 65535 && p !== 30333 && p !== 9615 // Exclude p2p & metrics port
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
              cause: new Error(`All candidate ports failed RPC test: ${candidatePorts.join(", ")}`),
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
