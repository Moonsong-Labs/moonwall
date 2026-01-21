import { describe, it, expect } from "bun:test";
import { Effect, Duration, Exit } from "effect";
import {
  OperationTimeoutError,
  TimeoutDefaults,
  withTimeout,
  foundationStartupTimeout,
  foundationShutdownTimeout,
  providerConnectionTimeout,
  blockCreationTimeout,
  storageOperationTimeout,
  healthCheckTimeout,
  rpcCallTimeout,
  websocketConnectionTimeout,
  portDiscoveryTimeout,
  nodeReadinessTimeout,
  customTimeout,
  isOperationTimeoutError,
  formatTimeoutError,
} from "../TimeoutPolicy.js";

describe("TimeoutPolicy", () => {
  describe("TimeoutDefaults", () => {
    it("should have expected default values", () => {
      expect(Duration.toMillis(TimeoutDefaults.foundationStartup)).toBe(120000); // 2 minutes
      expect(Duration.toMillis(TimeoutDefaults.foundationShutdown)).toBe(30000); // 30 seconds
      expect(Duration.toMillis(TimeoutDefaults.providerConnection)).toBe(300000); // 5 minutes
      expect(Duration.toMillis(TimeoutDefaults.blockCreation)).toBe(30000); // 30 seconds
      expect(Duration.toMillis(TimeoutDefaults.storageOperation)).toBe(10000); // 10 seconds
      expect(Duration.toMillis(TimeoutDefaults.healthCheck)).toBe(30000); // 30 seconds
      expect(Duration.toMillis(TimeoutDefaults.rpcCall)).toBe(10000); // 10 seconds
      expect(Duration.toMillis(TimeoutDefaults.websocketConnection)).toBe(30000); // 30 seconds
      expect(Duration.toMillis(TimeoutDefaults.portDiscovery)).toBe(120000); // 2 minutes
      expect(Duration.toMillis(TimeoutDefaults.nodeReadiness)).toBe(120000); // 2 minutes
    });
  });

  describe("OperationTimeoutError", () => {
    it("should create a tagged error with correct properties", () => {
      const error = new OperationTimeoutError({
        operation: "foundation_startup",
        description: "Starting foundation test-node",
        timeoutMs: 5000,
        endpoint: "ws://localhost:9944",
      });

      expect(error._tag).toBe("OperationTimeoutError");
      expect(error.operation).toBe("foundation_startup");
      expect(error.description).toBe("Starting foundation test-node");
      expect(error.timeoutMs).toBe(5000);
      expect(error.endpoint).toBe("ws://localhost:9944");
    });

    it("should generate user-friendly message", () => {
      const error = new OperationTimeoutError({
        operation: "foundation_startup",
        description: "Starting foundation test-node",
        timeoutMs: 5000,
        endpoint: "ws://localhost:9944",
      });

      expect(error.userMessage).toBe(
        "Operation timed out after 5s: Starting foundation test-node to ws://localhost:9944"
      );
    });

    it("should format duration correctly for milliseconds", () => {
      const error = new OperationTimeoutError({
        operation: "rpc_call",
        description: "RPC call: system_health",
        timeoutMs: 500,
      });

      expect(error.userMessage).toContain("500ms");
    });

    it("should format duration correctly for minutes", () => {
      const error = new OperationTimeoutError({
        operation: "foundation_startup",
        description: "Starting foundation",
        timeoutMs: 120000,
      });

      expect(error.userMessage).toContain("2m");
    });
  });

  describe("withTimeout", () => {
    it("should succeed when effect completes within timeout", async () => {
      const effect = Effect.succeed("success");

      const result = await Effect.runPromise(
        withTimeout(effect, {
          duration: "1 second",
          operation: "generic",
          description: "Test operation",
        })
      );

      expect(result).toBe("success");
    });

    it("should fail with OperationTimeoutError when effect exceeds timeout", async () => {
      const slowEffect = Effect.gen(function* () {
        yield* Effect.sleep("100 millis");
        return "too slow";
      });

      const exit = await Effect.runPromiseExit(
        withTimeout(slowEffect, {
          duration: "10 millis",
          operation: "generic",
          description: "Slow test operation",
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect(error).toBeInstanceOf(OperationTimeoutError);
        expect((error as OperationTimeoutError).operation).toBe("generic");
      }
    });

    it("should preserve original error when effect fails before timeout", async () => {
      class CustomError extends Error {
        _tag = "CustomError" as const;
      }

      const failingEffect = Effect.fail(new CustomError("Original error"));

      const exit = await Effect.runPromiseExit(
        withTimeout(failingEffect, {
          duration: "1 second",
          operation: "generic",
          description: "Test operation",
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        expect((error as CustomError)._tag).toBe("CustomError");
      }
    });
  });

  describe("Timeout config factories", () => {
    describe("foundationStartupTimeout", () => {
      it("should create config with default timeout", () => {
        const config = foundationStartupTimeout("test-node");

        expect(config.operation).toBe("foundation_startup");
        expect(config.description).toBe('Starting foundation "test-node"');
        expect(config.duration).toBe(TimeoutDefaults.foundationStartup);
      });

      it("should create config with custom timeout", () => {
        const config = foundationStartupTimeout("test-node", "30 seconds", "ws://localhost:9944");

        expect(config.duration).toBe("30 seconds");
        expect(config.endpoint).toBe("ws://localhost:9944");
      });
    });

    describe("foundationShutdownTimeout", () => {
      it("should create config with default timeout", () => {
        const config = foundationShutdownTimeout("test-node");

        expect(config.operation).toBe("foundation_shutdown");
        expect(config.description).toBe('Stopping foundation "test-node"');
        expect(config.duration).toBe(TimeoutDefaults.foundationShutdown);
      });
    });

    describe("providerConnectionTimeout", () => {
      it("should create config with all parameters", () => {
        const config = providerConnectionTimeout("polkadot", "polkadotJs", "wss://rpc.polkadot.io");

        expect(config.operation).toBe("provider_connection");
        expect(config.description).toBe('Connecting polkadotJs provider "polkadot"');
        expect(config.endpoint).toBe("wss://rpc.polkadot.io");
        expect(config.context?.providerType).toBe("polkadotJs");
      });
    });

    describe("blockCreationTimeout", () => {
      it("should create config for single block", () => {
        const config = blockCreationTimeout(1);

        expect(config.operation).toBe("block_creation");
        expect(config.description).toBe("Creating 1 block");
        expect(config.context?.blockCount).toBe(1);
      });

      it("should create config for multiple blocks", () => {
        const config = blockCreationTimeout(5);

        expect(config.operation).toBe("block_creation");
        expect(config.description).toBe("Creating 5 blocks");
        expect(config.context?.blockCount).toBe(5);
      });
    });

    describe("storageOperationTimeout", () => {
      it("should create config for storage operation", () => {
        const config = storageOperationTimeout("setStorage");

        expect(config.operation).toBe("storage_operation");
        expect(config.description).toBe("Executing storage operation: setStorage");
        expect(config.context?.operationType).toBe("setStorage");
      });
    });

    describe("healthCheckTimeout", () => {
      it("should create config for health check", () => {
        const config = healthCheckTimeout("dev-node", "ws://localhost:9944");

        expect(config.operation).toBe("health_check");
        expect(config.description).toBe('Health checking "dev-node"');
        expect(config.endpoint).toBe("ws://localhost:9944");
      });
    });

    describe("rpcCallTimeout", () => {
      it("should create config for RPC call", () => {
        const config = rpcCallTimeout("system_health", "ws://localhost:9944");

        expect(config.operation).toBe("rpc_call");
        expect(config.description).toBe("RPC call: system_health");
        expect(config.endpoint).toBe("ws://localhost:9944");
        expect(config.context?.method).toBe("system_health");
      });
    });

    describe("websocketConnectionTimeout", () => {
      it("should create config for WebSocket connection", () => {
        const config = websocketConnectionTimeout("ws://localhost:9944");

        expect(config.operation).toBe("websocket_connection");
        expect(config.description).toBe("Establishing WebSocket connection");
        expect(config.endpoint).toBe("ws://localhost:9944");
      });
    });

    describe("portDiscoveryTimeout", () => {
      it("should create config for port discovery", () => {
        const config = portDiscoveryTimeout(12345);

        expect(config.operation).toBe("port_discovery");
        expect(config.description).toBe("Discovering RPC port for PID 12345");
        expect(config.context?.pid).toBe(12345);
      });
    });

    describe("nodeReadinessTimeout", () => {
      it("should create config for node readiness", () => {
        const config = nodeReadinessTimeout(9944);

        expect(config.operation).toBe("node_readiness");
        expect(config.description).toBe("Waiting for node to be ready on port 9944");
        expect(config.endpoint).toBe("ws://localhost:9944");
        expect(config.context?.port).toBe(9944);
      });
    });

    describe("customTimeout", () => {
      it("should create custom config with minimal parameters", () => {
        const config = customTimeout("5 seconds", "Custom operation");

        expect(config.operation).toBe("generic");
        expect(config.duration).toBe("5 seconds");
        expect(config.description).toBe("Custom operation");
      });

      it("should create custom config with all parameters", () => {
        const config = customTimeout("5 seconds", "Custom operation", {
          operation: "rpc_call",
          endpoint: "https://api.example.com",
          context: { customField: "value" },
        });

        expect(config.operation).toBe("rpc_call");
        expect(config.endpoint).toBe("https://api.example.com");
        expect(config.context?.customField).toBe("value");
      });
    });
  });

  describe("isOperationTimeoutError", () => {
    it("should return true for OperationTimeoutError instance", () => {
      const error = new OperationTimeoutError({
        operation: "generic",
        description: "Test",
        timeoutMs: 1000,
      });

      expect(isOperationTimeoutError(error)).toBe(true);
    });

    it("should return true for object with matching _tag", () => {
      const error = {
        _tag: "OperationTimeoutError",
        operation: "generic",
        description: "Test",
        timeoutMs: 1000,
      };

      expect(isOperationTimeoutError(error)).toBe(true);
    });

    it("should return false for other errors", () => {
      expect(isOperationTimeoutError(new Error("test"))).toBe(false);
      expect(isOperationTimeoutError({ _tag: "OtherError" })).toBe(false);
      expect(isOperationTimeoutError(null)).toBe(false);
      expect(isOperationTimeoutError(undefined)).toBe(false);
    });
  });

  describe("formatTimeoutError", () => {
    it("should format foundation_startup error with suggestions", () => {
      const error = new OperationTimeoutError({
        operation: "foundation_startup",
        description: "Starting foundation test-node",
        timeoutMs: 120000,
      });

      const formatted = formatTimeoutError(error);

      expect(formatted).toContain("Operation timed out after 2m");
      expect(formatted).toContain("Suggestions:");
      expect(formatted).toContain("Check that the node binary is available");
    });

    it("should format provider_connection error with suggestions", () => {
      const error = new OperationTimeoutError({
        operation: "provider_connection",
        description: "Connecting provider",
        timeoutMs: 30000,
        endpoint: "wss://rpc.polkadot.io",
      });

      const formatted = formatTimeoutError(error);

      expect(formatted).toContain("Suggestions:");
      expect(formatted).toContain("Check that the endpoint is reachable");
    });

    it("should format block_creation error with suggestions", () => {
      const error = new OperationTimeoutError({
        operation: "block_creation",
        description: "Creating blocks",
        timeoutMs: 30000,
      });

      const formatted = formatTimeoutError(error);

      expect(formatted).toContain("Suggestions:");
      expect(formatted).toContain("chopsticks instance is responding");
    });

    it("should format health_check error with suggestions", () => {
      const error = new OperationTimeoutError({
        operation: "health_check",
        description: "Health check",
        timeoutMs: 30000,
      });

      const formatted = formatTimeoutError(error);

      expect(formatted).toContain("Suggestions:");
      expect(formatted).toContain("Verify the service is still running");
    });

    it("should format generic error without suggestions", () => {
      const error = new OperationTimeoutError({
        operation: "generic",
        description: "Generic operation",
        timeoutMs: 5000,
      });

      const formatted = formatTimeoutError(error);

      expect(formatted).toContain("Operation timed out after 5s");
      expect(formatted).not.toContain("Suggestions:");
    });
  });

  describe("Integration with Effect", () => {
    it("should work with Effect.gen and catchAll for error recovery", async () => {
      const slowEffect = Effect.gen(function* () {
        yield* Effect.sleep("100 millis");
        return "completed";
      });

      const result = await Effect.runPromise(
        withTimeout(slowEffect, {
          duration: "10 millis",
          operation: "generic",
          description: "Slow operation",
        }).pipe(
          Effect.catchAll((error) =>
            isOperationTimeoutError(error)
              ? Effect.succeed("recovered from timeout")
              : Effect.fail(error)
          )
        )
      );

      expect(result).toBe("recovered from timeout");
    });

    it("should work with Effect.map for transformation", async () => {
      const effect = Effect.succeed({ value: 42 });

      const result = await Effect.runPromise(
        withTimeout(effect, {
          duration: "1 second",
          operation: "generic",
          description: "Test",
        }).pipe(Effect.map((result) => result.value * 2))
      );

      expect(result).toBe(84);
    });

    it("should work with parallel effects", async () => {
      const fastEffect1 = withTimeout(Effect.succeed(1), {
        duration: "1 second",
        operation: "generic",
        description: "Fast 1",
      });

      const fastEffect2 = withTimeout(Effect.succeed(2), {
        duration: "1 second",
        operation: "generic",
        description: "Fast 2",
      });

      const result = await Effect.runPromise(
        Effect.all([fastEffect1, fastEffect2], { concurrency: 2 })
      );

      expect(result).toEqual([1, 2]);
    });
  });
});
