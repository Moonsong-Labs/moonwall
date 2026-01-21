import { describe, test, expect, afterAll } from "bun:test";
import { Effect } from "effect";
import {
  buildFoundationSpanName,
  buildProviderSpanName,
  buildTestSpanName,
  annotateFoundationSpan,
  annotateProviderSpan,
  annotateTestSpan,
  withFoundationSpan,
  withProviderSpan,
  withTestSpan,
  withSpan,
  isTracingEnabled,
  withTracingIfEnabled,
  TracerDefaults,
  type FoundationSpanAttributes,
  type ProviderSpanAttributes,
  type TestSpanAttributes,
} from "../Tracing.js";

describe("Tracing", () => {
  describe("buildFoundationSpanName", () => {
    test("creates span name without name parameter", () => {
      expect(buildFoundationSpanName("dev", "startup")).toBe("moonwall.foundation.dev.startup");
    });

    test("creates span name with name parameter", () => {
      expect(buildFoundationSpanName("dev", "startup", "moonbeam")).toBe(
        "moonwall.foundation.dev.startup[moonbeam]"
      );
    });

    test("creates span name for different foundation types", () => {
      expect(buildFoundationSpanName("chopsticks", "shutdown")).toBe(
        "moonwall.foundation.chopsticks.shutdown"
      );
      expect(buildFoundationSpanName("zombie", "healthCheck")).toBe(
        "moonwall.foundation.zombie.healthCheck"
      );
      expect(buildFoundationSpanName("read_only", "startup")).toBe(
        "moonwall.foundation.read_only.startup"
      );
    });

    test("creates span name for block creation", () => {
      expect(buildFoundationSpanName("chopsticks", "createBlock", "local")).toBe(
        "moonwall.foundation.chopsticks.createBlock[local]"
      );
    });

    test("creates span name for storage operations", () => {
      expect(buildFoundationSpanName("chopsticks", "setStorage")).toBe(
        "moonwall.foundation.chopsticks.setStorage"
      );
    });
  });

  describe("buildProviderSpanName", () => {
    test("creates span name without name parameter", () => {
      expect(buildProviderSpanName("ethers", "connect")).toBe("moonwall.provider.ethers.connect");
    });

    test("creates span name with name parameter", () => {
      expect(buildProviderSpanName("ethers", "connect", "eth-main")).toBe(
        "moonwall.provider.ethers.connect[eth-main]"
      );
    });

    test("creates span name for different provider types", () => {
      expect(buildProviderSpanName("polkadotJs", "disconnect")).toBe(
        "moonwall.provider.polkadotJs.disconnect"
      );
      expect(buildProviderSpanName("viem", "healthCheck")).toBe(
        "moonwall.provider.viem.healthCheck"
      );
      expect(buildProviderSpanName("web3", "connect")).toBe("moonwall.provider.web3.connect");
      expect(buildProviderSpanName("papi", "connect")).toBe("moonwall.provider.papi.connect");
    });

    test("creates span name for 'all' provider type", () => {
      expect(buildProviderSpanName("all", "connect")).toBe("moonwall.provider.all.connect");
    });
  });

  describe("buildTestSpanName", () => {
    test("creates span name without env name", () => {
      expect(buildTestSpanName("execution")).toBe("moonwall.test.execution");
    });

    test("creates span name with env name", () => {
      expect(buildTestSpanName("execution", "basic")).toBe("moonwall.test.execution[basic]");
    });

    test("creates span name for different operations", () => {
      expect(buildTestSpanName("setup", "dev_tests")).toBe("moonwall.test.setup[dev_tests]");
      expect(buildTestSpanName("teardown", "chopsticks")).toBe(
        "moonwall.test.teardown[chopsticks]"
      );
    });
  });

  describe("annotateFoundationSpan", () => {
    test("runs without error with minimal attributes", async () => {
      const program = annotateFoundationSpan("dev", "moonbeam");
      // Effect.annotateCurrentSpan is a no-op when there's no active span
      // so this should just succeed
      const result = await Effect.runPromise(program);
      expect(result).toBeUndefined();
    });

    test("runs without error with all attributes", async () => {
      const attributes: FoundationSpanAttributes = {
        port: 9944,
        endpoint: "ws://localhost:9944",
        pid: 12345,
        chainSpec: "moonbeam-dev",
        isEthereumChain: true,
      };
      const program = annotateFoundationSpan("dev", "moonbeam", attributes);
      const result = await Effect.runPromise(program);
      expect(result).toBeUndefined();
    });
  });

  describe("annotateProviderSpan", () => {
    test("runs without error with minimal attributes", async () => {
      const program = annotateProviderSpan("ethers", "eth-provider");
      const result = await Effect.runPromise(program);
      expect(result).toBeUndefined();
    });

    test("runs without error with all attributes", async () => {
      const attributes: ProviderSpanAttributes = {
        endpoint: "ws://localhost:9944",
        providerCount: 3,
        timeoutMs: 5000,
        retryAttempts: 10,
      };
      const program = annotateProviderSpan("ethers", "eth-provider", attributes);
      const result = await Effect.runPromise(program);
      expect(result).toBeUndefined();
    });
  });

  describe("annotateTestSpan", () => {
    test("runs without error with minimal attributes", async () => {
      const program = annotateTestSpan("basic");
      const result = await Effect.runPromise(program);
      expect(result).toBeUndefined();
    });

    test("runs without error with all attributes", async () => {
      const attributes: TestSpanAttributes = {
        envName: "basic",
        testFileCount: 10,
        pattern: "test_*.ts",
        timeoutMs: 30000,
        coverageEnabled: true,
      };
      const program = annotateTestSpan("basic", attributes);
      const result = await Effect.runPromise(program);
      expect(result).toBeUndefined();
    });
  });

  describe("withFoundationSpan", () => {
    test("wraps effect with span and preserves result", async () => {
      const program = Effect.succeed("success").pipe(
        withFoundationSpan("dev", "startup", "moonbeam")
      );
      const result = await Effect.runPromise(program);
      expect(result).toBe("success");
    });

    test("wraps effect with span and preserves error", async () => {
      const program = Effect.fail(new Error("test error")).pipe(
        withFoundationSpan("dev", "startup", "moonbeam")
      );
      await expect(Effect.runPromise(program)).rejects.toThrow("test error");
    });

    test("includes attributes in span", async () => {
      const program = Effect.succeed(42).pipe(
        withFoundationSpan("dev", "startup", "moonbeam", {
          port: 9944,
          isEthereumChain: true,
        })
      );
      const result = await Effect.runPromise(program);
      expect(result).toBe(42);
    });
  });

  describe("withProviderSpan", () => {
    test("wraps effect with span and preserves result", async () => {
      const program = Effect.succeed("connected").pipe(
        withProviderSpan("ethers", "connect", "eth-main")
      );
      const result = await Effect.runPromise(program);
      expect(result).toBe("connected");
    });

    test("wraps effect with span and preserves error", async () => {
      const program = Effect.fail(new Error("connection failed")).pipe(
        withProviderSpan("ethers", "connect", "eth-main")
      );
      await expect(Effect.runPromise(program)).rejects.toThrow("connection failed");
    });

    test("includes attributes in span", async () => {
      const program = Effect.succeed(true).pipe(
        withProviderSpan("ethers", "connect", "eth-main", {
          endpoint: "ws://localhost:9944",
          providerCount: 2,
        })
      );
      const result = await Effect.runPromise(program);
      expect(result).toBe(true);
    });
  });

  describe("withTestSpan", () => {
    test("wraps effect with span and preserves result", async () => {
      const program = Effect.succeed("tests passed").pipe(withTestSpan("execution", "basic"));
      const result = await Effect.runPromise(program);
      expect(result).toBe("tests passed");
    });

    test("wraps effect with span and preserves error", async () => {
      const program = Effect.fail(new Error("test failure")).pipe(
        withTestSpan("execution", "basic")
      );
      await expect(Effect.runPromise(program)).rejects.toThrow("test failure");
    });

    test("includes attributes in span", async () => {
      const program = Effect.succeed({ pass: 10, fail: 0 }).pipe(
        withTestSpan("execution", "basic", {
          testFileCount: 5,
          pattern: "*.test.ts",
        })
      );
      const result = await Effect.runPromise(program);
      expect(result).toEqual({ pass: 10, fail: 0 });
    });
  });

  describe("withSpan", () => {
    test("wraps effect with generic span", async () => {
      const program = Effect.succeed("done").pipe(withSpan("moonwall.config.load"));
      const result = await Effect.runPromise(program);
      expect(result).toBe("done");
    });

    test("includes attributes in span", async () => {
      const program = Effect.succeed("config loaded").pipe(
        withSpan("moonwall.config.load", { path: "./moonwall.config.json" })
      );
      const result = await Effect.runPromise(program);
      expect(result).toBe("config loaded");
    });

    test("filters out undefined attributes", async () => {
      const program = Effect.succeed("result").pipe(
        withSpan("moonwall.custom.op", {
          key1: "value1",
          key2: undefined,
          key3: 123,
        })
      );
      const result = await Effect.runPromise(program);
      expect(result).toBe("result");
    });
  });

  describe("isTracingEnabled", () => {
    const originalEnv = process.env.MOONWALL_TRACING;

    afterAll(() => {
      if (originalEnv === undefined) {
        delete process.env.MOONWALL_TRACING;
      } else {
        process.env.MOONWALL_TRACING = originalEnv;
      }
    });

    test("returns false when env var is not set", () => {
      delete process.env.MOONWALL_TRACING;
      expect(isTracingEnabled()).toBe(false);
    });

    test("returns true when env var is '1'", () => {
      process.env.MOONWALL_TRACING = "1";
      expect(isTracingEnabled()).toBe(true);
    });

    test("returns true when env var is 'true'", () => {
      process.env.MOONWALL_TRACING = "true";
      expect(isTracingEnabled()).toBe(true);
    });

    test("returns true when env var is 'enabled'", () => {
      process.env.MOONWALL_TRACING = "enabled";
      expect(isTracingEnabled()).toBe(true);
    });

    test("returns false for other values", () => {
      process.env.MOONWALL_TRACING = "false";
      expect(isTracingEnabled()).toBe(false);

      process.env.MOONWALL_TRACING = "0";
      expect(isTracingEnabled()).toBe(false);

      process.env.MOONWALL_TRACING = "disabled";
      expect(isTracingEnabled()).toBe(false);
    });
  });

  describe("withTracingIfEnabled", () => {
    const originalEnv = process.env.MOONWALL_TRACING;

    afterAll(() => {
      if (originalEnv === undefined) {
        delete process.env.MOONWALL_TRACING;
      } else {
        process.env.MOONWALL_TRACING = originalEnv;
      }
    });

    test("applies tracing when enabled", async () => {
      process.env.MOONWALL_TRACING = "1";
      const program = Effect.succeed("traced").pipe(withTracingIfEnabled("moonwall.test.span"));
      const result = await Effect.runPromise(program);
      expect(result).toBe("traced");
    });

    test("skips tracing when disabled", async () => {
      delete process.env.MOONWALL_TRACING;
      const program = Effect.succeed("untraced").pipe(withTracingIfEnabled("moonwall.test.span"));
      const result = await Effect.runPromise(program);
      expect(result).toBe("untraced");
    });
  });

  describe("TracerDefaults", () => {
    test("has expected default values", () => {
      expect(TracerDefaults.serviceName).toBe("moonwall");
      expect(TracerDefaults.enableConsoleOutput).toBe(false);
      expect(TracerDefaults.minDurationMs).toBe(0);
    });
  });

  describe("Span nesting", () => {
    test("nested spans complete in correct order", async () => {
      const innerEffect = Effect.succeed("inner").pipe(
        withFoundationSpan("dev", "healthCheck", "moonbeam")
      );

      const outerEffect = Effect.gen(function* () {
        const inner = yield* innerEffect;
        return `outer:${inner}`;
      }).pipe(withFoundationSpan("dev", "startup", "moonbeam"));

      const result = await Effect.runPromise(outerEffect);
      expect(result).toBe("outer:inner");
    });

    test("mixed span types nest correctly", async () => {
      const providerSpan = Effect.succeed("provider").pipe(
        withProviderSpan("ethers", "connect", "eth-main")
      );

      const testSpan = Effect.gen(function* () {
        const provider = yield* providerSpan;
        return `test:${provider}`;
      }).pipe(withTestSpan("execution", "basic"));

      const foundationSpan = Effect.gen(function* () {
        const test = yield* testSpan;
        return `foundation:${test}`;
      }).pipe(withFoundationSpan("dev", "startup", "moonbeam"));

      const result = await Effect.runPromise(foundationSpan);
      expect(result).toBe("foundation:test:provider");
    });
  });

  describe("Error handling with spans", () => {
    test("span captures error from failing effect", async () => {
      const program = Effect.fail(new Error("operation failed")).pipe(
        withFoundationSpan("dev", "startup", "moonbeam"),
        Effect.catchAll((error) => Effect.succeed(`caught: ${error.message}`))
      );
      const result = await Effect.runPromise(program);
      expect(result).toBe("caught: operation failed");
    });

    test("span captures error from async effect", async () => {
      const program = Effect.tryPromise({
        try: () => Promise.reject(new Error("async error")),
        catch: (e) => e as Error,
      }).pipe(
        withProviderSpan("ethers", "connect", "eth-main"),
        Effect.catchAll((error) => Effect.succeed(`caught: ${error.message}`))
      );
      const result = await Effect.runPromise(program);
      expect(result).toBe("caught: async error");
    });
  });

  describe("Effect type preservation", () => {
    test("withFoundationSpan preserves effect type", async () => {
      // This test verifies type preservation at compile time
      const effect: Effect.Effect<number, Error> = Effect.succeed(42);
      const traced: Effect.Effect<number, Error> = effect.pipe(
        withFoundationSpan("dev", "startup", "moonbeam")
      );
      const result = await Effect.runPromise(traced);
      expect(result).toBe(42);
    });

    test("withProviderSpan preserves effect type", async () => {
      const effect: Effect.Effect<string, Error> = Effect.succeed("test");
      const traced: Effect.Effect<string, Error> = effect.pipe(
        withProviderSpan("ethers", "connect", "eth-main")
      );
      const result = await Effect.runPromise(traced);
      expect(result).toBe("test");
    });

    test("withTestSpan preserves effect type", async () => {
      const effect: Effect.Effect<boolean, Error> = Effect.succeed(true);
      const traced: Effect.Effect<boolean, Error> = effect.pipe(withTestSpan("execution", "basic"));
      const result = await Effect.runPromise(traced);
      expect(result).toBe(true);
    });
  });
});
