import { Command, Socket, type CommandExecutor } from "@effect/platform";
import * as NodeCommandExecutor from "@effect/platform-node/NodeCommandExecutor";
import * as NodeContext from "@effect/platform-node/NodeContext";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodeSocket from "@effect/platform-node/NodeSocket";
import { createLogger } from "@moonwall/util";
import { Context, Deferred, Effect, Layer, Option, type Scope } from "effect";
import { PortDiscoveryError } from "./errors.js";
import { networkRetryPolicy, makeRetryPolicy } from "./RetryPolicy.js";

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
const getAllPorts = (
  pid: number
): Effect.Effect<number[], PortDiscoveryError, CommandExecutor.CommandExecutor> =>
  Command.make("lsof", "-p", `${pid}`, "-n", "-P").pipe(
    Command.pipeTo(Command.make("grep", "LISTEN")),
    Command.string,
    Effect.map(parsePortsFromLsof),
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
    ),
    Effect.catchAll((cause) =>
      Effect.fail(
        new PortDiscoveryError({
          cause,
          pid,
          attempts: 1,
        })
      )
    )
  );

/**
 * Test a single RPC method on a socket
 */
const testRpcMethod = (
  method: string
): Effect.Effect<boolean, PortDiscoveryError, Socket.Socket | Scope.Scope> =>
  Effect.flatMap(Deferred.make<boolean, Error>(), (responseDeferred) =>
    Effect.flatMap(Socket.Socket, (socket) =>
      Effect.flatMap(socket.writer, (writer) => {
        const request = new TextEncoder().encode(
          JSON.stringify({
            jsonrpc: "2.0",
            id: Math.floor(Math.random() * 10000),
            method,
            params: [],
          })
        );

        const handleMessages = socket.runRaw((data: string | Uint8Array) =>
          Effect.try(() => {
            const message = typeof data === "string" ? data : new TextDecoder().decode(data);
            const response = JSON.parse(message);
            return response.jsonrpc === "2.0" && !response.error;
          }).pipe(
            Effect.orElseSucceed(() => false),
            Effect.flatMap((shouldSucceed) =>
              shouldSucceed ? Deferred.succeed(responseDeferred, true) : Effect.void
            )
          )
        );

        return Effect.all([
          Effect.fork(handleMessages),
          Effect.flatMap(writer(request), () => Effect.void),
          Deferred.await(responseDeferred).pipe(
            Effect.timeoutOption("3 seconds"),
            Effect.map((opt) => (opt._tag === "Some" ? opt.value : false))
          ),
        ]).pipe(
          Effect.map(([_, __, result]) => result),
          Effect.catchAll((cause) =>
            Effect.fail(
              new PortDiscoveryError({
                cause,
                pid: 0,
                attempts: 1,
              })
            )
          )
        );
      })
    )
  );

/**
 * Test if a port responds to RPC calls using Effect Socket
 */
const testRpcPort = (
  port: number,
  isEthereumChain: boolean
): Effect.Effect<number, PortDiscoveryError> =>
  Effect.scoped(
    Effect.provide(
      Effect.flatMap(testRpcMethod("system_chain"), (success) => {
        if (success) {
          debug(`Port ${port} responded to system_chain`);
          return Effect.succeed(port);
        }

        if (!isEthereumChain) {
          return Effect.fail(
            new PortDiscoveryError({
              cause: new Error(`Port ${port} did not respond to system_chain`),
              pid: 0,
              attempts: 1,
            })
          );
        }

        // If Ethereum chain, try eth_chainId
        return Effect.flatMap(testRpcMethod("eth_chainId"), (ethSuccess) => {
          if (ethSuccess) {
            debug(`Port ${port} responded to eth_chainId`);
            return Effect.succeed(port);
          }

          return Effect.fail(
            new PortDiscoveryError({
              cause: new Error(`Port ${port} did not respond to eth_chainId`),
              pid: 0,
              attempts: 1,
            })
          );
        });
      }),
      NodeSocket.layerWebSocket(`ws://localhost:${port}`)
    )
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
 * Discover RPC port by racing tests on all candidate ports.
 *
 * Uses exponential backoff with jitter for retry:
 * 50ms -> 100ms -> 200ms -> ... -> 5s (capped)
 *
 * This allows quick discovery when nodes start fast, while
 * backing off gracefully during slower startups.
 */
const discoverRpcPortWithRace = (config: {
  pid: number;
  isEthereumChain: boolean;
  maxAttempts?: number;
}): Effect.Effect<number, PortDiscoveryError> => {
  const maxAttempts = config.maxAttempts || 2400;

  // Use network retry policy for RPC port discovery
  // 2400 attempts is more than default 200, so use custom policy
  const retryPolicy =
    maxAttempts <= 200
      ? networkRetryPolicy<PortDiscoveryError>()
      : makeRetryPolicy<PortDiscoveryError>(maxAttempts, "50 millis", "5 seconds");

  return getAllPorts(config.pid).pipe(
    Effect.flatMap((allPorts) => {
      debug(`Discovered ports: ${allPorts.join(", ")}`);

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
    // Retry the entire discovery process with exponential backoff
    Effect.retry(retryPolicy),
    Effect.catchAll((error) =>
      Effect.fail(
        new PortDiscoveryError({
          cause: error,
          pid: config.pid,
          attempts: maxAttempts,
        })
      )
    ),
    Effect.provide(
      NodeCommandExecutor.layer.pipe(
        Layer.provide(NodeContext.layer),
        Layer.provide(NodeFileSystem.layer)
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
