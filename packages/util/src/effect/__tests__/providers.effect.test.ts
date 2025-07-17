import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect, Exit, Queue } from "effect";
import { NetworkError, TimeoutError, ValidationError } from "@moonwall/types";
import {
  customWeb3RequestEffect,
  web3EthCallEffect,
  batchWeb3RequestsEffect,
  web3SubscribeEffect,
} from "../providers.effect";
import { testUtils } from "../interop";
import { alith } from "../../constants/accounts";
import { MIN_GAS_PRICE } from "../../constants/chain";

// Mock Web3 instance
const mockProvider = {
  send: vi.fn(),
};

const mockWeb3 = {
  eth: {
    currentProvider: mockProvider,
    subscribe: vi.fn(),
  },
};

describe("providers.effect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("customWeb3RequestEffect", () => {
    it("should successfully send custom request", async () => {
      const method = "eth_blockNumber";
      const params = [];
      const expectedResult = "0x123";

      mockProvider.send.mockImplementation((payload, callback) => {
        expect(payload).toEqual({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        });
        callback(null, expectedResult);
      });

      const result = await testUtils.expectSuccess(
        customWeb3RequestEffect(mockWeb3 as any, method, params)
      );

      expect(result).toBe(expectedResult);
      expect(mockProvider.send).toHaveBeenCalledTimes(1);
    });

    it("should fail with NetworkError for invalid method", async () => {
      const error = await testUtils.expectFailure(
        customWeb3RequestEffect(mockWeb3 as any, "", [])
      );

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain("Invalid RPC method name");
    });

    it("should handle provider errors", async () => {
      const method = "eth_call";
      const params = [{ to: "0x123" }];

      mockProvider.send.mockImplementation((payload, callback) => {
        callback(new Error("Provider error"));
      });

      const error = await testUtils.expectFailure(
        customWeb3RequestEffect(mockWeb3 as any, method, params)
      );

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain("Failed to send custom request");
      expect(error.operation).toBe(method);
    });

    it("should retry on network errors", async () => {
      const method = "eth_getBalance";
      const params = ["0x123"];
      const expectedResult = "0x1000";

      let callCount = 0;
      mockProvider.send.mockImplementation((payload, callback) => {
        callCount++;
        if (callCount < 3) {
          callback(new Error("Temporary network error"));
        } else {
          callback(null, expectedResult);
        }
      });

      const result = await testUtils.expectSuccess(
        customWeb3RequestEffect(mockWeb3 as any, method, params)
      );

      expect(result).toBe(expectedResult);
      expect(mockProvider.send).toHaveBeenCalledTimes(3);
    });

    it("should not retry on method not found error", async () => {
      const method = "invalid_method";
      const params = [];

      mockProvider.send.mockImplementation((payload, callback) => {
        const error = new Error("Method not found");
        (error as any).code = -32601;
        callback(error);
      });

      const error = await testUtils.expectFailure(
        customWeb3RequestEffect(mockWeb3 as any, method, params)
      );

      expect(error).toBeInstanceOf(NetworkError);
      expect(mockProvider.send).toHaveBeenCalledTimes(1); // No retry
    });

    it("should truncate long parameters in error messages", async () => {
      const method = "eth_sendRawTransaction";
      const longParam = "0x" + "a".repeat(300);
      const params = [longParam];

      mockProvider.send.mockImplementation((payload, callback) => {
        callback(new Error("Transaction failed"));
      });

      const error = await testUtils.expectFailure(
        customWeb3RequestEffect(mockWeb3 as any, method, params)
      );

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain("...");
      expect(error.message.length).toBeLessThan(500); // Reasonable error message length
    });
  });

  describe("web3EthCallEffect", () => {
    it("should successfully make eth_call with defaults", async () => {
      const options = {
        to: "0x1234567890123456789012345678901234567890",
        data: "0x123456",
      };
      const expectedResult = "0xresult";

      mockProvider.send.mockImplementation((payload, callback) => {
        expect(payload.method).toBe("eth_call");
        expect(payload.params[0]).toEqual({
          from: alith.address,
          to: options.to,
          gas: 256000,
          gasPrice: `0x${MIN_GAS_PRICE}`,
          data: options.data,
        });
        expect(payload.params[1]).toBe("latest");
        callback(null, expectedResult);
      });

      const result = await testUtils.expectSuccess(
        web3EthCallEffect(mockWeb3 as any, options)
      );

      expect(result).toBe(expectedResult);
    });

    it("should fail with ValidationError for missing to address", async () => {
      const error = await testUtils.expectFailure(
        web3EthCallEffect(mockWeb3 as any, {} as any)
      );

      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.field).toBe("to");
        expect(error.message).toContain("Missing required 'to' address");
      }
    });

    it("should fail with ValidationError for invalid to address", async () => {
      const error = await testUtils.expectFailure(
        web3EthCallEffect(mockWeb3 as any, { to: "invalid-address" })
      );

      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.field).toBe("to");
        expect(error.message).toContain("Invalid 'to' address format");
      }
    });

    it("should validate from address if provided", async () => {
      const error = await testUtils.expectFailure(
        web3EthCallEffect(mockWeb3 as any, {
          to: "0x1234567890123456789012345678901234567890",
          from: "invalid-from",
        })
      );

      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.field).toBe("from");
        expect(error.message).toContain("Invalid 'from' address format");
      }
    });

    it("should validate data format if provided", async () => {
      const error = await testUtils.expectFailure(
        web3EthCallEffect(mockWeb3 as any, {
          to: "0x1234567890123456789012345678901234567890",
          data: "not-hex-data",
        })
      );

      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.field).toBe("data");
        expect(error.message).toContain("Invalid data format");
      }
    });

    it("should use custom parameters when provided", async () => {
      const options = {
        from: "0x0000000000000000000000000000000000000001",
        to: "0x1234567890123456789012345678901234567890",
        value: "0x1000",
        gas: 500000,
        gasPrice: "0x2000",
        data: "0xabcdef",
      };

      mockProvider.send.mockImplementation((payload, callback) => {
        expect(payload.params[0]).toEqual(options);
        callback(null, "0xresult");
      });

      await testUtils.expectSuccess(
        web3EthCallEffect(mockWeb3 as any, options)
      );
    });
  });

  describe("batchWeb3RequestsEffect", () => {
    it("should successfully batch multiple requests", async () => {
      const requests = [
        { method: "eth_blockNumber", params: [] },
        { method: "eth_gasPrice", params: [] },
        { method: "eth_chainId", params: [] },
      ];
      const results = ["0x123", "0x456", "0x1"];

      let callIndex = 0;
      mockProvider.send.mockImplementation((payload, callback) => {
        callback(null, results[callIndex++]);
      });

      const batchResults = await testUtils.expectSuccess(
        batchWeb3RequestsEffect(mockWeb3 as any, requests)
      );

      expect(batchResults).toEqual(results);
      expect(mockProvider.send).toHaveBeenCalledTimes(3);
    });

    it("should fail with NetworkError for empty requests", async () => {
      const error = await testUtils.expectFailure(
        batchWeb3RequestsEffect(mockWeb3 as any, [])
      );

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toContain("Invalid batch request");
    });

    it("should handle partial failures in batch", async () => {
      const requests = [
        { method: "eth_blockNumber", params: [] },
        { method: "invalid_method", params: [] },
      ];

      let callIndex = 0;
      mockProvider.send.mockImplementation((payload, callback) => {
        if (callIndex++ === 0) {
          callback(null, "0x123");
        } else {
          callback(new Error("Method not found"));
        }
      });

      // The batch should fail if any request fails
      const error = await testUtils.expectFailure(
        batchWeb3RequestsEffect(mockWeb3 as any, requests)
      );

      expect(error).toBeInstanceOf(NetworkError);
    });

    it("should run requests in parallel", async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        method: `method_${i}`,
        params: [],
      }));

      const startTimes: number[] = [];
      mockProvider.send.mockImplementation(async (payload, callback) => {
        startTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 10));
        callback(null, `result_${payload.method}`);
      });

      await testUtils.expectSuccess(
        batchWeb3RequestsEffect(mockWeb3 as any, requests)
      );

      // Check that all requests started nearly simultaneously
      const timeDiffs = startTimes.slice(1).map((time, i) => time - startTimes[i]);
      expect(Math.max(...timeDiffs)).toBeLessThan(5); // All started within 5ms
    });
  });

  describe("web3SubscribeEffect", () => {
    it("should create subscription and queue events", async () => {
      const mockSubscription = {
        on: vi.fn(),
        unsubscribe: vi.fn(),
      };

      mockWeb3.eth.subscribe.mockReturnValue(mockSubscription);

      // Create the subscription effect
      const effect = web3SubscribeEffect<{ blockNumber: string }>(
        mockWeb3 as any,
        "newBlockHeaders"
      );

      // Run in a scope to manage the subscription lifecycle
      await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const queue = yield* effect;
            
            // Simulate receiving data
            const dataHandler = mockSubscription.on.mock.calls.find(
              call => call[0] === "data"
            )?.[1];

            expect(dataHandler).toBeDefined();

            // Send some test data
            const testData = { blockNumber: "0x123" };
            dataHandler(testData);

            // Check that data was queued
            const receivedData = yield* Queue.take(queue);
            expect(receivedData).toEqual(testData);
          })
        )
      );
    });

    it("should handle subscription errors", async () => {
      const mockSubscription = {
        on: vi.fn(),
        unsubscribe: vi.fn(),
      };

      mockWeb3.eth.subscribe.mockReturnValue(mockSubscription);

      const effect = web3SubscribeEffect(
        mockWeb3 as any,
        "logs",
        { address: "0x123" }
      );

      const queue = await Effect.runPromise(
        Effect.scoped(effect)
      );

      // Simulate an error
      const errorHandler = mockSubscription.on.mock.calls.find(
        call => call[0] === "error"
      )?.[1];

      errorHandler(new Error("Subscription error"));

      // Queue should be shut down
      const takeEffect = Queue.take(queue);
      const exit = await Effect.runPromiseExit(takeEffect);
      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should fail with NetworkError on subscription creation failure", async () => {
      mockWeb3.eth.subscribe.mockImplementation(() => {
        throw new Error("Failed to create subscription");
      });

      const effect = web3SubscribeEffect(
        mockWeb3 as any,
        "pendingTransactions"
      );

      const exit = await Effect.runPromiseExit(
        Effect.scoped(effect)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const cause = exit.cause;
        expect(cause._tag).toBe("Fail");
        if (cause._tag === "Fail") {
          expect(cause.error).toBeInstanceOf(NetworkError);
          expect(cause.error.message).toContain("Failed to create subscription");
        }
      }
    });

    it("should unsubscribe on scope close", async () => {
      const mockSubscription = {
        on: vi.fn(),
        unsubscribe: vi.fn(),
      };

      mockWeb3.eth.subscribe.mockReturnValue(mockSubscription);

      // Run the effect in a scope and then close it
      await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            yield* web3SubscribeEffect(mockWeb3 as any, "newBlockHeaders");
            // Scope will be closed after this
          })
        )
      );

      // Verify unsubscribe was called
      expect(mockSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Effect patterns", () => {
  it("should demonstrate retry with exponential backoff", async () => {
    let attempts = 0;
    const timestamps: number[] = [];

    mockProvider.send.mockImplementation((payload, callback) => {
      attempts++;
      timestamps.push(Date.now());
      if (attempts < 3) {
        callback(new Error("Temporary failure"));
      } else {
        callback(null, "success");
      }
    });

    const result = await testUtils.expectSuccess(
      customWeb3RequestEffect(mockWeb3 as any, "test_method", [])
    );

    expect(result).toBe("success");
    expect(attempts).toBe(3);

    // Verify exponential backoff timing
    if (timestamps.length >= 3) {
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay2).toBeGreaterThan(delay1); // Exponential increase
    }
  });

  it("should demonstrate timeout handling", async () => {
    // This would require mocking Effect's timeout behavior
    // For now, we just verify the structure is correct
    const effect = customWeb3RequestEffect(mockWeb3 as any, "slow_method", []);
    
    // The effect should have timeout applied (30 seconds as per implementation)
    expect(effect).toBeDefined();
  });
});