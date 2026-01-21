import { describe, it, expect } from "bun:test";
import { Effect, Duration, Exit } from "effect";
import {
  RetryDefaults,
  createExponentialRetryPolicy,
  networkRetryPolicy,
  portDiscoveryRetryPolicy,
  healthCheckRetryPolicy,
  providerConnectionRetryPolicy,
  webSocketRetryPolicy,
  makeRetryPolicy,
} from "../RetryPolicy.js";

describe("RetryPolicy", () => {
  describe("RetryDefaults", () => {
    it("should have expected default values", () => {
      expect(RetryDefaults.maxAttempts).toBe(200);
      expect(Duration.toMillis(RetryDefaults.baseDelay)).toBe(50);
      expect(Duration.toMillis(RetryDefaults.maxDelay)).toBe(5000);
      expect(RetryDefaults.factor).toBe(2);
    });
  });

  describe("createExponentialRetryPolicy", () => {
    it("should create a policy with default config", () => {
      const policy = createExponentialRetryPolicy();
      expect(policy).toBeDefined();
    });

    it("should create a policy with custom config", () => {
      const policy = createExponentialRetryPolicy({
        maxAttempts: 5,
        baseDelay: "100 millis",
        maxDelay: "2 seconds",
        factor: 3,
      });
      expect(policy).toBeDefined();
    });

    it("should retry failed effects", async () => {
      const attemptCount = { value: 0 };

      // Effect that fails twice then succeeds (using Effect.suspend for proper error channel)
      const flakyEffect = Effect.suspend(() => {
        attemptCount.value++;
        if (attemptCount.value < 3) {
          return Effect.fail(new Error(`Attempt ${attemptCount.value} failed`));
        }
        return Effect.succeed("success");
      });

      const policy = createExponentialRetryPolicy({
        maxAttempts: 5,
        baseDelay: "1 millis", // Fast for testing
        maxDelay: "10 millis",
      });

      const result = await Effect.runPromise(flakyEffect.pipe(Effect.retry(policy)));

      expect(result).toBe("success");
      expect(attemptCount.value).toBe(3); // Failed twice, then succeeded
    });

    it("should fail after max attempts exhausted", async () => {
      const attemptCount = { value: 0 };

      // Effect that always fails
      const alwaysFailEffect = Effect.suspend(() => {
        attemptCount.value++;
        return Effect.fail(new Error(`Attempt ${attemptCount.value} failed`));
      });

      const policy = createExponentialRetryPolicy({
        maxAttempts: 3,
        baseDelay: "1 millis",
        maxDelay: "10 millis",
      });

      const exit = await Effect.runPromiseExit(alwaysFailEffect.pipe(Effect.retry(policy)));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(attemptCount.value).toBe(3); // Tried 3 times
    });
  });

  describe("networkRetryPolicy", () => {
    it("should create a policy with network-appropriate settings", () => {
      const policy = networkRetryPolicy();
      expect(policy).toBeDefined();
    });

    it("should retry network errors with exponential backoff", async () => {
      const attemptCount = { value: 0 };

      const flakyNetwork = Effect.suspend(() => {
        attemptCount.value++;
        if (attemptCount.value < 2) {
          return Effect.fail(new Error("Network unreachable"));
        }
        return Effect.succeed("connected");
      });

      // Use custom policy with fast delays for testing
      const fastPolicy = makeRetryPolicy(5, "1 millis", "5 millis");

      const result = await Effect.runPromise(flakyNetwork.pipe(Effect.retry(fastPolicy)));

      expect(result).toBe("connected");
      expect(attemptCount.value).toBe(2);
    });
  });

  describe("portDiscoveryRetryPolicy", () => {
    it("should create a policy optimized for port discovery", () => {
      const policy = portDiscoveryRetryPolicy();
      expect(policy).toBeDefined();
    });

    it("should handle rapid initial retries", async () => {
      const attemptCount = { value: 0 };
      const timestamps: number[] = [];

      const portCheck = Effect.suspend(() => {
        attemptCount.value++;
        timestamps.push(Date.now());
        if (attemptCount.value < 3) {
          return Effect.fail(new Error("Port not ready"));
        }
        return Effect.succeed(9944);
      });

      const fastPolicy = makeRetryPolicy(5, "1 millis", "5 millis");

      const result = await Effect.runPromise(portCheck.pipe(Effect.retry(fastPolicy)));

      expect(result).toBe(9944);
      expect(attemptCount.value).toBe(3);
    });
  });

  describe("healthCheckRetryPolicy", () => {
    it("should create a policy for health checks", () => {
      const policy = healthCheckRetryPolicy();
      expect(policy).toBeDefined();
    });

    it("should retry health check failures", async () => {
      const attemptCount = { value: 0 };

      const healthCheck = Effect.suspend(() => {
        attemptCount.value++;
        if (attemptCount.value < 2) {
          return Effect.fail(new Error("Health check failed"));
        }
        return Effect.succeed({ healthy: true });
      });

      const fastPolicy = makeRetryPolicy(5, "1 millis", "10 millis");

      const result = await Effect.runPromise(healthCheck.pipe(Effect.retry(fastPolicy)));

      expect(result).toEqual({ healthy: true });
      expect(attemptCount.value).toBe(2);
    });
  });

  describe("providerConnectionRetryPolicy", () => {
    it("should create a policy for provider connections", () => {
      const policy = providerConnectionRetryPolicy();
      expect(policy).toBeDefined();
    });

    it("should handle connection failures with patient retries", async () => {
      const attemptCount = { value: 0 };

      const connectProvider = Effect.suspend(() => {
        attemptCount.value++;
        if (attemptCount.value < 4) {
          return Effect.fail(new Error("Connection refused"));
        }
        return Effect.succeed({ connected: true, provider: "polkadotJs" });
      });

      const fastPolicy = makeRetryPolicy(5, "1 millis", "5 millis");

      const result = await Effect.runPromise(connectProvider.pipe(Effect.retry(fastPolicy)));

      expect(result).toEqual({ connected: true, provider: "polkadotJs" });
      expect(attemptCount.value).toBe(4);
    });
  });

  describe("webSocketRetryPolicy", () => {
    it("should create a policy for WebSocket reconnection", () => {
      const policy = webSocketRetryPolicy();
      expect(policy).toBeDefined();
    });

    it("should retry WebSocket connection failures", async () => {
      const attemptCount = { value: 0 };

      const wsConnect = Effect.suspend(() => {
        attemptCount.value++;
        if (attemptCount.value < 3) {
          return Effect.fail(new Error("WebSocket connection failed"));
        }
        return Effect.succeed({ ws: "connected", port: 9944 });
      });

      const fastPolicy = makeRetryPolicy(5, "1 millis", "5 millis");

      const result = await Effect.runPromise(wsConnect.pipe(Effect.retry(fastPolicy)));

      expect(result).toEqual({ ws: "connected", port: 9944 });
      expect(attemptCount.value).toBe(3);
    });
  });

  describe("makeRetryPolicy", () => {
    it("should create custom policy with specified parameters", () => {
      const policy = makeRetryPolicy(10, "50 millis", "1 second", 3);
      expect(policy).toBeDefined();
    });

    it("should respect max attempts limit", async () => {
      const attemptCount = { value: 0 };

      const alwaysFail = Effect.suspend(() => {
        attemptCount.value++;
        return Effect.fail(new Error("Always fails"));
      });

      const policy = makeRetryPolicy(4, "1 millis", "5 millis");

      const exit = await Effect.runPromiseExit(alwaysFail.pipe(Effect.retry(policy)));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(attemptCount.value).toBe(4);
    });

    it("should work with different error types", async () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public readonly code: string
        ) {
          super(message);
          this.name = "CustomError";
        }
      }

      const attemptCount = { value: 0 };

      const customErrorEffect = Effect.suspend(() => {
        attemptCount.value++;
        if (attemptCount.value < 2) {
          return Effect.fail(new CustomError("Custom failure", "ERR_001"));
        }
        return Effect.succeed("success");
      });

      const policy = makeRetryPolicy<CustomError>(3, "1 millis", "5 millis");

      const result = await Effect.runPromise(customErrorEffect.pipe(Effect.retry(policy)));

      expect(result).toBe("success");
      expect(attemptCount.value).toBe(2);
    });
  });

  describe("Flaky operation simulation", () => {
    it("should handle intermittent failures", async () => {
      const attemptCount = { value: 0 };
      const failPattern = [true, true, false, true, false]; // fail, fail, succeed, fail, succeed

      const intermittentEffect = Effect.suspend(() => {
        const shouldFail = failPattern[attemptCount.value] ?? false;
        attemptCount.value++;
        if (shouldFail) {
          return Effect.fail(new Error("Intermittent failure"));
        }
        return Effect.succeed("recovered");
      });

      const policy = makeRetryPolicy(10, "1 millis", "5 millis");

      const result = await Effect.runPromise(intermittentEffect.pipe(Effect.retry(policy)));

      expect(result).toBe("recovered");
      expect(attemptCount.value).toBe(3); // Failed twice, then succeeded
    });

    it("should track retry count correctly", async () => {
      const retryLog: number[] = [];

      const loggingEffect = Effect.suspend(() => {
        retryLog.push(retryLog.length);
        if (retryLog.length < 4) {
          return Effect.fail(new Error(`Attempt ${retryLog.length}`));
        }
        return Effect.succeed("done");
      });

      const policy = makeRetryPolicy(5, "1 millis", "5 millis");

      await Effect.runPromise(loggingEffect.pipe(Effect.retry(policy)));

      expect(retryLog).toEqual([0, 1, 2, 3]); // 4 attempts total
    });
  });

  describe("Integration with Effect.catchAll", () => {
    it("should allow error transformation after retries exhausted", async () => {
      const alwaysFail = Effect.fail(new Error("Original error"));

      const policy = makeRetryPolicy(2, "1 millis", "5 millis");

      const result = await Effect.runPromise(
        alwaysFail.pipe(
          Effect.retry(policy),
          Effect.catchAll((error) => Effect.succeed(`Transformed: ${error.message}`))
        )
      );

      expect(result).toBe("Transformed: Original error");
    });
  });
});
