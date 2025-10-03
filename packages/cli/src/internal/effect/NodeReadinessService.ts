import { Socket } from "@effect/platform";
import * as NodeSocket from "@effect/platform-node/NodeSocket";
import { createLogger } from "@moonwall/util";
import { Context, Deferred, Effect, Fiber, Layer, Schedule, type Scope } from "effect";
import { NodeReadinessError } from "./errors.js";

const logger = createLogger({ name: "NodeReadinessService" });
const debug = logger.debug.bind(logger);

/**
 * Configuration for readiness check
 */
export interface ReadinessConfig {
  readonly port: number;
  readonly isEthereumChain: boolean;
  readonly maxAttempts?: number;
}

/**
 * Service for checking node readiness via WebSocket JSON-RPC
 */
export class NodeReadinessService extends Context.Tag("NodeReadinessService")<
  NodeReadinessService,
  {
    /**
     * Check if node is ready to accept connections
     * @param config Readiness check configuration
     * @returns true if node is ready
     */
    readonly checkReady: (config: ReadinessConfig) => Effect.Effect<boolean, NodeReadinessError>;
  }
>() {}

/**
 * Send JSON-RPC request and wait for response using Effect Socket
 */
const sendRpcRequest = (
  method: string
): Effect.Effect<boolean, NodeReadinessError, Socket.Socket | Scope.Scope> =>
  Effect.flatMap(Deferred.make<boolean, Error>(), (responseDeferred) =>
    Effect.flatMap(Socket.Socket, (socket) =>
      Effect.flatMap(socket.writer, (writer) => {
        debug(`Checking method: ${method}`);

        const request = new TextEncoder().encode(
          JSON.stringify({
            jsonrpc: "2.0",
            id: Math.floor(Math.random() * 10000),
            method,
            params: [],
          })
        );

        // Set up message handler
        const handleMessages = socket.runRaw((data: string | Uint8Array) => {
          try {
            const message = typeof data === "string" ? data : new TextDecoder().decode(data);
            debug(`Got message for ${method}: ${message.substring(0, 100)}`);
            const response = JSON.parse(message);
            debug(`Parsed response: jsonrpc=${response.jsonrpc}, error=${response.error}`);

            if (response.jsonrpc === "2.0" && !response.error) {
              debug(`Method ${method} succeeded!`);
              return Deferred.succeed(responseDeferred, true);
            }
          } catch (e) {
            debug(`Parse error for ${method}: ${e}`);
          }
          return Effect.void;
        });

        // Send request and wait for response
        return Effect.flatMap(Effect.fork(handleMessages), (messageFiber) =>
          Effect.flatMap(writer(request), () =>
            // Wait for either:
            // 1. Deferred resolving with response (success)
            // 2. Timeout (fails with error)
            // Also check if the message fiber has failed
            Deferred.await(responseDeferred).pipe(
              Effect.timeoutFail({
                duration: "2 seconds",
                onTimeout: () => new Error("RPC request timed out waiting for response"),
              }),
              // After getting result, check if fiber failed and prefer that error
              Effect.flatMap((result) =>
                Fiber.poll(messageFiber).pipe(
                  Effect.flatMap((pollResult) => {
                    if (pollResult._tag === "Some") {
                      const exit = pollResult.value;
                      if (exit._tag === "Failure") {
                        // Fiber failed - propagate that error instead of returning result
                        return Effect.failCause(exit.cause);
                      }
                    }
                    return Effect.succeed(result);
                  })
                )
              )
            )
          ).pipe(
            Effect.ensuring(Fiber.interrupt(messageFiber)),
            Effect.catchAll((cause) =>
              Effect.fail(
                new NodeReadinessError({
                  cause,
                  port: 0, // Will be filled in by caller
                  attemptsExhausted: 1,
                })
              )
            )
          )
        );
      })
    )
  );

/**
 * Attempt single WebSocket readiness check using Effect Socket
 */
const attemptReadinessCheck = (
  config: ReadinessConfig
): Effect.Effect<boolean, NodeReadinessError, Socket.Socket> =>
  Effect.logDebug(
    `Attempting readiness check on port ${config.port}, isEthereum: ${config.isEthereumChain}`
  ).pipe(
    Effect.flatMap(() =>
      Effect.scoped(
        Effect.flatMap(sendRpcRequest("system_chain"), (systemChainOk) => {
          if (systemChainOk) {
            return Effect.succeed(true);
          }

          // If Ethereum chain, also try eth_chainId
          if (config.isEthereumChain) {
            return sendRpcRequest("eth_chainId");
          }

          return Effect.succeed(false);
        })
      ).pipe(
        Effect.timeoutFail({
          duration: "3 seconds",
          onTimeout: () =>
            new NodeReadinessError({
              cause: new Error("Readiness check timed out"),
              port: config.port,
              attemptsExhausted: 1,
            }),
        }),
        Effect.catchAll((cause) =>
          Effect.fail(
            new NodeReadinessError({
              cause,
              port: config.port,
              attemptsExhausted: 1,
            })
          )
        )
      )
    )
  );

/**
 * Check node readiness with retry (internal, requires Socket.Socket)
 */
const checkReadyWithRetryInternal = (
  config: ReadinessConfig
): Effect.Effect<boolean, NodeReadinessError, Socket.Socket> => {
  const maxAttempts = config.maxAttempts || 30;

  return attemptReadinessCheck(config).pipe(
    Effect.retry(
      Schedule.fixed("200 millis").pipe(Schedule.compose(Schedule.recurs(maxAttempts - 1)))
    ),
    Effect.catchAll((error) =>
      Effect.fail(
        new NodeReadinessError({
          cause: error,
          port: config.port,
          attemptsExhausted: maxAttempts,
        })
      )
    )
  );
};

/**
 * Check node readiness with retry (public, provides real WebSocket layer)
 */
const checkReadyWithRetry = (
  config: ReadinessConfig
): Effect.Effect<boolean, NodeReadinessError> => {
  return checkReadyWithRetryInternal(config).pipe(
    Effect.provide(NodeSocket.layerWebSocket(`ws://localhost:${config.port}`))
  );
};

/**
 * Live implementation of NodeReadinessService
 */
export const NodeReadinessServiceLive = Layer.succeed(NodeReadinessService, {
  checkReady: checkReadyWithRetry,
});

/**
 * Test implementation that accepts a custom Socket layer
 * Used for testing with mock Sockets
 */
export const makeNodeReadinessServiceTest = (
  socketLayer: Layer.Layer<Socket.Socket>
): Layer.Layer<NodeReadinessService> =>
  Layer.succeed(NodeReadinessService, {
    checkReady: (config: ReadinessConfig) =>
      checkReadyWithRetryInternal(config).pipe(Effect.provide(socketLayer)),
  });
