import { Effect, Context, Layer, Schedule } from "effect";
import { WebSocket } from "ws";
import { NodeReadinessError } from "./errors.js";
import { createLogger } from "@moonwall/util";

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
 * Attempt single WebSocket readiness check using Promise-based approach
 */
const attemptReadinessCheck = (
  config: ReadinessConfig
): Effect.Effect<boolean, NodeReadinessError> =>
  Effect.logDebug(
    `Attempting readiness check on port ${config.port}, isEthereum: ${config.isEthereumChain}`
  ).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () =>
          new Promise<boolean>((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${config.port}`);
            let resolved = false;

            const cleanup = () => {
              if (!resolved) {
                resolved = true;
                try {
                  ws.close();
                } catch (_e) {
                  // Ignore cleanup errors
                }
              }
            };

            const checkMethod = (method: string): Promise<boolean> => {
              return new Promise((methodResolve) => {
                debug(`Checking method: ${method}`);
                const timeout = setTimeout(() => {
                  debug(`Method ${method} timed out after 2s`);
                  ws.removeListener("message", messageHandler);
                  methodResolve(false);
                }, 2000);

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
                    debug(`Got message for ${method}: ${data.toString().substring(0, 100)}`);
                    const response = JSON.parse(data.toString());
                    debug(`Parsed response: jsonrpc=${response.jsonrpc}, error=${response.error}`);
                    if (response.jsonrpc === "2.0" && !response.error) {
                      debug(`Method ${method} succeeded!`);
                      clearTimeout(timeout);
                      ws.removeListener("message", messageHandler);
                      methodResolve(true);
                    } else {
                      debug(`Response didn't match criteria`);
                    }
                  } catch (e) {
                    // Clean up on parse errors
                    debug(`Parse error for ${method}: ${e}`);
                    clearTimeout(timeout);
                    ws.removeListener("message", messageHandler);
                    methodResolve(false);
                  }
                };

                ws.on("message", messageHandler);
              });
            };

            ws.on("open", async () => {
              try {
                // Check system_chain first (works for all chains)
                const systemChainOk = await checkMethod("system_chain");
                if (systemChainOk) {
                  if (!resolved) {
                    resolved = true;
                    resolve(true);
                  }
                  cleanup();
                  return;
                }

                // If Ethereum chain, also try eth_chainId
                if (config.isEthereumChain) {
                  const ethOk = await checkMethod("eth_chainId");
                  if (!resolved) {
                    resolved = true;
                    resolve(ethOk);
                  }
                  cleanup();
                  return;
                }

                if (!resolved) {
                  resolved = true;
                  resolve(false);
                }
                cleanup();
              } catch (error) {
                if (!resolved) {
                  resolved = true;
                  reject(error);
                }
                cleanup();
              }
            });

            ws.on("error", (error) => {
              if (!resolved) {
                resolved = true;
                reject(error);
              }
              cleanup();
            });

            // Timeout after 3 seconds
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                reject(new Error("WebSocket connection timeout"));
              }
              cleanup();
            }, 3000);
          }),
        catch: (cause) =>
          new NodeReadinessError({
            cause,
            port: config.port,
            attemptsExhausted: 1,
          }),
      })
    )
  );

/**
 * Check node readiness with retry
 */
const checkReadyWithRetry = (
  config: ReadinessConfig
): Effect.Effect<boolean, NodeReadinessError> => {
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
 * Live implementation of NodeReadinessService
 */
export const NodeReadinessServiceLive = Layer.succeed(NodeReadinessService, {
  checkReady: checkReadyWithRetry,
});
