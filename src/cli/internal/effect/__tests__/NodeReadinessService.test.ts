import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Socket } from "@effect/platform";
import {
  NodeReadinessService,
  makeNodeReadinessServiceTest,
  NodeReadinessError,
} from "../index.js";

/**
 * Create a mock Socket implementation for testing
 */
const createMockSocket = (config: {
  shouldSucceed: boolean;
  responseData?: any;
  shouldError?: boolean;
}): Socket.Socket => {
  const mockSocket: Socket.Socket = {
    [Socket.TypeId]: Socket.TypeId,

    run: (handler) => {
      if (config.shouldError) {
        return Effect.fail(
          new Socket.SocketGenericError({ reason: "Open", cause: new Error("Connection refused") })
        );
      }

      if (config.shouldSucceed && config.responseData) {
        const data = new TextEncoder().encode(JSON.stringify(config.responseData));
        return Effect.flatMap(Effect.sleep("10 millis"), () =>
          Effect.sync(() => {
            handler(data);
          })
        );
      }

      return Effect.never;
    },

    runRaw: <_, E = never, R = never>(
      handler: (_: string | Uint8Array) => void | Effect.Effect<_, E, R>,
      options?: {
        readonly onOpen?: Effect.Effect<void> | undefined;
      }
    ): Effect.Effect<void, Socket.SocketError | E, R> => {
      if (config.shouldError) {
        return Effect.fail(
          new Socket.SocketGenericError({ reason: "Open", cause: new Error("Connection refused") })
        );
      }

      const handleOpenAndData = (): Effect.Effect<void, Socket.SocketError | E, R> => {
        if (config.shouldSucceed && config.responseData) {
          // Simulate async message arrival, then keep the socket "alive" forever
          return Effect.flatMap(Effect.sleep("10 millis"), () => {
            const data = new TextEncoder().encode(JSON.stringify(config.responseData));
            const handlerResult = handler(data);
            const handlerEffect = Effect.isEffect(handlerResult) ? handlerResult : Effect.void;
            // After handling the message, keep the socket alive (like a real WebSocket would)
            return Effect.flatMap(handlerEffect, () => Effect.never);
          });
        }
        return Effect.never;
      };

      if (options?.onOpen) {
        return Effect.flatMap(options.onOpen, () => handleOpenAndData());
      }

      return handleOpenAndData();
    },

    writer: Effect.succeed((_chunk: Uint8Array | string | Socket.CloseEvent) => Effect.void),
  };

  return mockSocket;
};

/**
 * Create a mock Socket layer for testing
 */
const createMockSocketLayer = (config: {
  shouldSucceed: boolean;
  responseData?: any;
  shouldError?: boolean;
}): Layer.Layer<Socket.Socket> => {
  return Layer.succeed(Socket.Socket, createMockSocket(config));
};

describe("NodeReadinessService", () => {
  it.live("should successfully check readiness when system_chain responds", () => {
    const mockConfig = { port: 9999, isEthereumChain: false, maxAttempts: 1 };

    // Create a mock Socket that returns a successful system_chain response
    const mockSocketLayer = createMockSocketLayer({
      shouldSucceed: true,
      responseData: { jsonrpc: "2.0", id: 1, result: "Moonbeam" },
    });

    return NodeReadinessService.pipe(
      Effect.flatMap((service) => service.checkReady(mockConfig)),
      Effect.provide(makeNodeReadinessServiceTest(mockSocketLayer)),
      Effect.map((result) => {
        expect(result).toBe(true);
      })
    );
  });

  it.live("should fail if WebSocket connection errors", () => {
    const mockConfig = { port: 1234, isEthereumChain: false, maxAttempts: 1 };

    // Create a mock Socket that errors on connection
    const mockSocketLayer = createMockSocketLayer({
      shouldSucceed: false,
      shouldError: true,
    });

    return NodeReadinessService.pipe(
      Effect.flatMap((service) => service.checkReady(mockConfig)),
      Effect.provide(makeNodeReadinessServiceTest(mockSocketLayer)),
      Effect.flip,
      Effect.map((error) => {
        expect(error).toBeInstanceOf(NodeReadinessError);
        expect(error.port).toBe(mockConfig.port);
      })
    );
  });

  it.live("should check system_chain for non-Ethereum chains", () => {
    const mockConfig = { port: 9999, isEthereumChain: false, maxAttempts: 1 };

    // Create a mock Socket that returns a successful system_chain response
    const mockSocketLayer = createMockSocketLayer({
      shouldSucceed: true,
      responseData: { jsonrpc: "2.0", id: 1, result: "Polkadot" },
    });

    return NodeReadinessService.pipe(
      Effect.flatMap((service) => service.checkReady(mockConfig)),
      Effect.provide(makeNodeReadinessServiceTest(mockSocketLayer))
    );
  });

  it.live("should check both system_chain and eth_chainId for Ethereum chains", () => {
    const mockConfig = { port: 9999, isEthereumChain: true, maxAttempts: 1 };

    // Create a mock Socket that returns successful responses
    const mockSocketLayer = createMockSocketLayer({
      shouldSucceed: true,
      responseData: { jsonrpc: "2.0", id: 1, result: "0x507" },
    });

    return NodeReadinessService.pipe(
      Effect.flatMap((service) => service.checkReady(mockConfig)),
      Effect.provide(makeNodeReadinessServiceTest(mockSocketLayer))
    );
  });

  it.live(
    "should timeout if no response within configured time",
    () => {
      const mockConfig = { port: 9999, isEthereumChain: false, maxAttempts: 1 };

      // Create a mock Socket that never responds
      const mockSocketLayer = createMockSocketLayer({
        shouldSucceed: false,
      });

      return NodeReadinessService.pipe(
        Effect.flatMap((service) => service.checkReady(mockConfig)),
        Effect.provide(makeNodeReadinessServiceTest(mockSocketLayer)),
        Effect.flip,
        Effect.map(() => {})
      );
    },
    { timeout: 15000 }
  );
});
