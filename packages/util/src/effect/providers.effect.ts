import { Effect, Schedule, Duration, Queue, Scope } from "effect";
import { NetworkError, TimeoutError, ValidationError } from "@moonwall/types";
import type { Web3 } from "web3";
import { alith } from "../constants/accounts";
import { MIN_GAS_PRICE } from "../constants/chain";
import type { Web3EthCallOptions } from "../functions/providers";

/**
 * Effect-based implementation of customWeb3Request
 * Sends a custom JSON-RPC request with proper error handling and retry logic
 */
export const customWeb3RequestEffect = (
  web3: Web3,
  method: string,
  params: any[]
): Effect.Effect<any, NetworkError | TimeoutError> =>
  Effect.gen(function* () {
    // Validate method name
    if (!method || typeof method !== "string") {
      return yield* Effect.fail(
        new NetworkError({
          message: "Invalid RPC method name",
          endpoint: "web3",
          operation: "customWeb3Request",
          cause: new Error("Method must be a non-empty string"),
        })
      );
    }

    // Create the RPC request
    const rpcRequest = Effect.async<any, NetworkError>((resume) => {
      try {
        ((web3.eth as any).currentProvider as any).send(
          {
            jsonrpc: "2.0",
            id: 1,
            method,
            params,
          },
          (error: Error | null, result?: any) => {
            if (error) {
              const paramStr = params
                .map((p) => {
                  const str = p?.toString() || "";
                  return str.length > 128 ? `${str.slice(0, 96)}...${str.slice(-28)}` : str;
                })
                .join(",");
              
              resume(
                Effect.fail(
                  new NetworkError({
                    message: `Failed to send custom request (${method} (${paramStr}))`,
                    endpoint: "web3",
                    operation: method,
                    cause: error,
                  })
                )
              );
            } else {
              resume(Effect.succeed(result));
            }
          }
        );
      } catch (error) {
        resume(
          Effect.fail(
            new NetworkError({
              message: `Failed to send custom request: ${method}`,
              endpoint: "web3",
              operation: method,
              cause: error,
            })
          )
        );
      }
    });

    // Add retry logic with exponential backoff
    const requestWithRetry = rpcRequest.pipe(
      Effect.retry({
        times: 3,
        schedule: Schedule.exponential(Duration.millis(100)),
        while: (error) => {
          // Don't retry on certain errors
          if (error.cause && typeof error.cause === "object" && "code" in error.cause) {
            const code = (error.cause as any).code;
            // Don't retry on method not found, invalid params, etc.
            if (code === -32601 || code === -32602 || code === -32700) {
              return false;
            }
          }
          return true;
        },
      })
    );

    // Add timeout
    const requestWithTimeout = requestWithRetry.pipe(
      Effect.timeout(Duration.seconds(30)),
      Effect.catchTag("TimeoutException", () =>
        Effect.fail(
          new TimeoutError({
            message: `RPC request timed out: ${method}`,
            operation: "customWeb3Request",
            timeout: 30000,
          })
        )
      )
    );

    return yield* requestWithTimeout;
  });

/**
 * Effect-based implementation of web3EthCall
 * Performs an eth_call with validation, retry logic, and timeout handling
 */
export const web3EthCallEffect = (
  web3: Web3,
  options: Web3EthCallOptions
): Effect.Effect<any, NetworkError | ValidationError | TimeoutError> =>
  Effect.gen(function* () {
    // Validate required 'to' address
    if (!options.to) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Missing required 'to' address",
          field: "to",
          value: undefined,
          expected: "valid Ethereum address",
        })
      );
    }

    // Validate 'to' address format
    if (!options.to.match(/^0x[a-fA-F0-9]{40}$/)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid 'to' address format",
          field: "to",
          value: options.to,
          expected: "0x followed by 40 hexadecimal characters",
        })
      );
    }

    // Validate 'from' address if provided
    if (options.from && typeof options.from === "string") {
      if (!options.from.match(/^0x[a-fA-F0-9]{40}$/)) {
        return yield* Effect.fail(
          new ValidationError({
            message: "Invalid 'from' address format",
            field: "from",
            value: options.from,
            expected: "0x followed by 40 hexadecimal characters",
          })
        );
      }
    }

    // Validate data format if provided
    if (options.data && !options.data.match(/^0x[a-fA-F0-9]*$/)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Invalid data format",
          field: "data",
          value: options.data.substring(0, 66) + "...", // Truncate for error message
          expected: "0x followed by hexadecimal characters",
        })
      );
    }

    // Prepare the call parameters with defaults
    const callParams = {
      from: options.from === undefined ? alith.address : options.from,
      to: options.to,
      value: options.value,
      gas: options.gas === undefined ? 256000 : options.gas,
      gasPrice: options.gasPrice === undefined ? `0x${MIN_GAS_PRICE}` : options.gasPrice,
      data: options.data,
    };

    // Remove undefined values to avoid sending them in the RPC call
    const cleanParams = Object.entries(callParams).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    // Use customWeb3RequestEffect for the actual call
    return yield* customWeb3RequestEffect(web3, "eth_call", [cleanParams, "latest"]);
  });

/**
 * Effect-based wrapper for batch Web3 requests
 * Allows sending multiple requests in parallel with proper error handling
 */
export const batchWeb3RequestsEffect = <T extends readonly { method: string; params: any[] }[]>(
  web3: Web3,
  requests: T
): Effect.Effect<{ [K in keyof T]: any }, NetworkError | TimeoutError> =>
  Effect.gen(function* () {
    // Validate requests array
    if (!Array.isArray(requests) || requests.length === 0) {
      return yield* Effect.fail(
        new NetworkError({
          message: "Invalid batch request: empty or not an array",
          endpoint: "web3",
          operation: "batchWeb3Requests",
        })
      );
    }

    // Create effects for all requests
    const effects = requests.map((req) => customWeb3RequestEffect(web3, req.method, req.params));

    // Run all requests in parallel
    const results = yield* Effect.all(effects, {
      concurrency: "unbounded",
      batching: true,
    });

    return results as any;
  });

/**
 * Effect-based implementation for subscribing to Web3 events
 * Provides a structured way to handle subscriptions with proper cleanup
 */
export const web3SubscribeEffect = <T>(
  web3: Web3,
  type: "newBlockHeaders" | "pendingTransactions" | "logs",
  params?: any
): Effect.Effect<Queue.Queue<T>, NetworkError, Scope.Scope> =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<T>();

    const subscription = yield* Effect.acquireRelease(
      Effect.try({
        try: () => {
          const sub = (web3.eth as any).subscribe(type, params || {});
          
          sub.on("data", (data: T) => {
            Effect.runSync(Queue.offer(queue, data));
          });

          sub.on("error", (error: Error) => {
            Effect.runSync(
              Queue.shutdown(queue)
            );
          });

          return sub;
        },
        catch: (error) =>
          new NetworkError({
            message: `Failed to create subscription: ${type}`,
            endpoint: "web3",
            operation: "subscribe",
            cause: error,
          }),
      }),
      (sub) =>
        Effect.gen(function* () {
          yield* Effect.try(() => sub.unsubscribe()).pipe(
            Effect.catchAll(() => Effect.void)
          );
          yield* Queue.shutdown(queue);
        })
    );

    return queue;
  });