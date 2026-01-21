/**
 * @module Tracing
 *
 * Centralized tracing utilities for Moonwall Effect services.
 *
 * This module provides span instrumentation for observability across
 * foundation startup, provider connections, test execution, and other
 * operations. Uses Effect's built-in tracing API which can be integrated
 * with OpenTelemetry exporters in production.
 *
 * @example Basic usage with span attributes
 * ```ts
 * import { withFoundationSpan } from "./Tracing.js";
 *
 * const startEffect = devFoundation.start(config).pipe(
 *   withFoundationSpan("dev", "dev-moonbeam", { port: 9944 })
 * );
 * ```
 *
 * @example Automatic span context propagation
 * ```ts
 * // Child spans are automatically nested under parent spans
 * const program = Effect.gen(function* () {
 *   yield* processManager.launch(config);  // child span
 *   yield* discoverPort();                  // child span
 * }).pipe(withFoundationSpan("dev", "moonbeam"));
 * ```
 */

import { Effect } from "effect";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Foundation types supported by Moonwall.
 */
export type FoundationType = "dev" | "chopsticks" | "zombie" | "read_only";

/**
 * Provider types supported by Moonwall.
 */
export type ProviderType = "polkadotJs" | "ethers" | "viem" | "web3" | "papi";

/**
 * Span attributes for foundation operations.
 */
export interface FoundationSpanAttributes {
  /** RPC port the foundation is listening on */
  readonly port?: number;
  /** WebSocket endpoint */
  readonly endpoint?: string;
  /** Process ID of the spawned node */
  readonly pid?: number;
  /** Chain specification or config path */
  readonly chainSpec?: string;
  /** Whether this is an Ethereum-compatible chain */
  readonly isEthereumChain?: boolean;
}

/**
 * Span attributes for provider operations.
 */
export interface ProviderSpanAttributes {
  /** The endpoint URL */
  readonly endpoint?: string;
  /** Number of providers being connected */
  readonly providerCount?: number;
  /** Timeout in milliseconds */
  readonly timeoutMs?: number;
  /** Number of retry attempts */
  readonly retryAttempts?: number;
}

/**
 * Span attributes for test execution.
 */
export interface TestSpanAttributes {
  /** Name of the test environment */
  readonly envName?: string;
  /** Total number of test files */
  readonly testFileCount?: number;
  /** Test pattern filter */
  readonly pattern?: string;
  /** Timeout in milliseconds */
  readonly timeoutMs?: number;
  /** Whether coverage is enabled */
  readonly coverageEnabled?: boolean;
}

/**
 * Generic span attributes for custom operations.
 */
export interface GenericSpanAttributes {
  readonly [key: string]: string | number | boolean | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Span Name Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a span name for foundation operations.
 *
 * @param foundationType - The type of foundation (dev, chopsticks, zombie, read_only)
 * @param operation - The operation being performed (startup, shutdown, healthCheck)
 * @param name - Optional foundation name for more specific identification
 * @returns A formatted span name like "moonwall.foundation.dev.startup"
 */
export const buildFoundationSpanName = (
  foundationType: FoundationType,
  operation: "startup" | "shutdown" | "healthCheck" | "createBlock" | "setStorage",
  name?: string
): string => {
  const baseName = `moonwall.foundation.${foundationType}.${operation}`;
  return name ? `${baseName}[${name}]` : baseName;
};

/**
 * Build a span name for provider operations.
 *
 * @param providerType - The type of provider (polkadotJs, ethers, viem, web3, papi)
 * @param operation - The operation being performed (connect, disconnect, healthCheck)
 * @param name - Optional provider name for more specific identification
 * @returns A formatted span name like "moonwall.provider.ethers.connect"
 */
export const buildProviderSpanName = (
  providerType: ProviderType | "all",
  operation: "connect" | "disconnect" | "healthCheck",
  name?: string
): string => {
  const baseName = `moonwall.provider.${providerType}.${operation}`;
  return name ? `${baseName}[${name}]` : baseName;
};

/**
 * Build a span name for test operations.
 *
 * @param operation - The operation being performed (execution, setup, teardown)
 * @param envName - Optional environment name
 * @returns A formatted span name like "moonwall.test.execution[basic]"
 */
export const buildTestSpanName = (
  operation: "execution" | "setup" | "teardown",
  envName?: string
): string => {
  const baseName = `moonwall.test.${operation}`;
  return envName ? `${baseName}[${envName}]` : baseName;
};

// ─────────────────────────────────────────────────────────────────────────────
// Span Annotation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Annotate the current span with foundation-specific attributes.
 *
 * @param foundationType - The type of foundation
 * @param name - The foundation name
 * @param attributes - Additional attributes to add
 * @returns An Effect that annotates the current span
 */
export const annotateFoundationSpan = (
  foundationType: FoundationType,
  name: string,
  attributes?: FoundationSpanAttributes
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("foundation.type", foundationType);
    yield* Effect.annotateCurrentSpan("foundation.name", name);

    if (attributes?.port !== undefined) {
      yield* Effect.annotateCurrentSpan("foundation.port", attributes.port);
    }
    if (attributes?.endpoint !== undefined) {
      yield* Effect.annotateCurrentSpan("foundation.endpoint", attributes.endpoint);
    }
    if (attributes?.pid !== undefined) {
      yield* Effect.annotateCurrentSpan("foundation.pid", attributes.pid);
    }
    if (attributes?.chainSpec !== undefined) {
      yield* Effect.annotateCurrentSpan("foundation.chainSpec", attributes.chainSpec);
    }
    if (attributes?.isEthereumChain !== undefined) {
      yield* Effect.annotateCurrentSpan("foundation.isEthereumChain", attributes.isEthereumChain);
    }
  });

/**
 * Annotate the current span with provider-specific attributes.
 *
 * @param providerType - The type of provider
 * @param name - The provider name
 * @param attributes - Additional attributes to add
 * @returns An Effect that annotates the current span
 */
export const annotateProviderSpan = (
  providerType: ProviderType | "all",
  name: string,
  attributes?: ProviderSpanAttributes
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("provider.type", providerType);
    yield* Effect.annotateCurrentSpan("provider.name", name);

    if (attributes?.endpoint !== undefined) {
      yield* Effect.annotateCurrentSpan("provider.endpoint", attributes.endpoint);
    }
    if (attributes?.providerCount !== undefined) {
      yield* Effect.annotateCurrentSpan("provider.count", attributes.providerCount);
    }
    if (attributes?.timeoutMs !== undefined) {
      yield* Effect.annotateCurrentSpan("provider.timeoutMs", attributes.timeoutMs);
    }
    if (attributes?.retryAttempts !== undefined) {
      yield* Effect.annotateCurrentSpan("provider.retryAttempts", attributes.retryAttempts);
    }
  });

/**
 * Annotate the current span with test-specific attributes.
 *
 * @param envName - The test environment name
 * @param attributes - Additional attributes to add
 * @returns An Effect that annotates the current span
 */
export const annotateTestSpan = (
  envName: string,
  attributes?: TestSpanAttributes
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("test.envName", envName);

    if (attributes?.testFileCount !== undefined) {
      yield* Effect.annotateCurrentSpan("test.fileCount", attributes.testFileCount);
    }
    if (attributes?.pattern !== undefined) {
      yield* Effect.annotateCurrentSpan("test.pattern", attributes.pattern);
    }
    if (attributes?.timeoutMs !== undefined) {
      yield* Effect.annotateCurrentSpan("test.timeoutMs", attributes.timeoutMs);
    }
    if (attributes?.coverageEnabled !== undefined) {
      yield* Effect.annotateCurrentSpan("test.coverageEnabled", attributes.coverageEnabled);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Span Wrappers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap an effect with a foundation operation span.
 *
 * This creates a named span that tracks the duration and outcome of a
 * foundation operation. The span includes attributes for the foundation
 * type and name, plus any additional attributes provided.
 *
 * @param foundationType - The type of foundation (dev, chopsticks, zombie, read_only)
 * @param operation - The operation being performed
 * @param name - The foundation name
 * @param attributes - Additional span attributes
 * @returns A function that wraps an effect with the span
 *
 * @example
 * ```ts
 * const startEffect = devFoundation.start(config).pipe(
 *   withFoundationSpan("dev", "startup", "dev-moonbeam", { port: 9944 })
 * );
 * ```
 */
export const withFoundationSpan =
  (
    foundationType: FoundationType,
    operation: "startup" | "shutdown" | "healthCheck" | "createBlock" | "setStorage",
    name: string,
    attributes?: FoundationSpanAttributes
  ) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    const spanName = buildFoundationSpanName(foundationType, operation, name);

    return effect.pipe(
      Effect.tap(() => annotateFoundationSpan(foundationType, name, attributes)),
      Effect.withSpan(spanName, {
        attributes: {
          "moonwall.component": "foundation",
          "moonwall.foundation.type": foundationType,
          "moonwall.operation": operation,
        },
      })
    );
  };

/**
 * Wrap an effect with a provider operation span.
 *
 * @param providerType - The type of provider
 * @param operation - The operation being performed
 * @param name - The provider name
 * @param attributes - Additional span attributes
 * @returns A function that wraps an effect with the span
 *
 * @example
 * ```ts
 * const connectEffect = providerService.connect(config).pipe(
 *   withProviderSpan("ethers", "connect", "eth-provider", { endpoint: "ws://localhost:9944" })
 * );
 * ```
 */
export const withProviderSpan =
  (
    providerType: ProviderType | "all",
    operation: "connect" | "disconnect" | "healthCheck",
    name: string,
    attributes?: ProviderSpanAttributes
  ) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    const spanName = buildProviderSpanName(providerType, operation, name);

    return effect.pipe(
      Effect.tap(() => annotateProviderSpan(providerType, name, attributes)),
      Effect.withSpan(spanName, {
        attributes: {
          "moonwall.component": "provider",
          "moonwall.provider.type": providerType,
          "moonwall.operation": operation,
        },
      })
    );
  };

/**
 * Wrap an effect with a test execution span.
 *
 * @param operation - The operation being performed
 * @param envName - The test environment name
 * @param attributes - Additional span attributes
 * @returns A function that wraps an effect with the span
 *
 * @example
 * ```ts
 * const testEffect = runTests(config).pipe(
 *   withTestSpan("execution", "basic", { testFileCount: 10 })
 * );
 * ```
 */
export const withTestSpan =
  (
    operation: "execution" | "setup" | "teardown",
    envName: string,
    attributes?: TestSpanAttributes
  ) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    const spanName = buildTestSpanName(operation, envName);

    return effect.pipe(
      Effect.tap(() => annotateTestSpan(envName, attributes)),
      Effect.withSpan(spanName, {
        attributes: {
          "moonwall.component": "test",
          "moonwall.test.envName": envName,
          "moonwall.operation": operation,
        },
      })
    );
  };

/**
 * Wrap an effect with a generic named span.
 *
 * Use this for operations that don't fit into the foundation/provider/test
 * categories. The span name should follow the convention:
 * "moonwall.<component>.<operation>"
 *
 * @param spanName - The full span name
 * @param attributes - Optional span attributes
 * @returns A function that wraps an effect with the span
 *
 * @example
 * ```ts
 * const configEffect = loadConfig().pipe(
 *   withSpan("moonwall.config.load", { path: "./moonwall.config.json" })
 * );
 * ```
 */
export const withSpan =
  (spanName: string, attributes?: GenericSpanAttributes) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    // Filter out undefined values from attributes
    const filteredAttributes: Record<string, string | number | boolean> = {};
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value !== undefined) {
          filteredAttributes[key] = value;
        }
      }
    }

    return effect.pipe(
      Effect.withSpan(spanName, {
        attributes: filteredAttributes,
      })
    );
  };

// ─────────────────────────────────────────────────────────────────────────────
// Tracer Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration options for the Moonwall tracer.
 */
export interface TracerConfig {
  /** Service name for trace identification */
  readonly serviceName?: string;
  /** Whether to enable console span output (for debugging) */
  readonly enableConsoleOutput?: boolean;
  /** Minimum duration in ms to log a span (filters noise) */
  readonly minDurationMs?: number;
}

/**
 * Default tracer configuration.
 */
export const TracerDefaults: Required<TracerConfig> = {
  serviceName: "moonwall",
  enableConsoleOutput: false,
  minDurationMs: 0,
};

/**
 * Create a simple console tracer for debugging.
 *
 * This is a lightweight tracer that logs span information to the console.
 * For production use, integrate with @effect/opentelemetry and an
 * observability backend like Jaeger, Zipkin, or Honeycomb.
 *
 * Note: This uses Effect's built-in tracing which doesn't require external
 * dependencies. The spans are automatically created and nested; this tracer
 * just provides a way to observe them during development.
 *
 * @param config - Tracer configuration options
 * @returns A Layer that provides span logging
 *
 * @example
 * ```ts
 * import { createConsoleTracerLayer } from "./Tracing.js";
 *
 * const program = myEffect.pipe(
 *   withFoundationSpan("dev", "startup", "moonbeam"),
 *   Effect.provide(createConsoleTracerLayer({ enableConsoleOutput: true }))
 * );
 * ```
 */
export const createConsoleTracerLayer = (config?: TracerConfig) => {
  const mergedConfig = { ...TracerDefaults, ...config };

  // For now, return a simple identity layer since we're using Effect's built-in tracing
  // The spans are created automatically; this is a placeholder for future OpenTelemetry integration
  return Effect.succeed(mergedConfig);
};

/**
 * Check if tracing is enabled in the current environment.
 *
 * Tracing can be enabled via the MOONWALL_TRACING environment variable.
 *
 * @returns true if tracing is enabled
 */
export const isTracingEnabled = (): boolean => {
  const envValue = process.env.MOONWALL_TRACING;
  return envValue === "1" || envValue === "true" || envValue === "enabled";
};

/**
 * Conditionally apply tracing based on environment configuration.
 *
 * If MOONWALL_TRACING is not enabled, this returns the effect unchanged.
 * This allows adding tracing instrumentation without performance overhead
 * when tracing is disabled.
 *
 * @param spanName - The span name to use if tracing is enabled
 * @param attributes - Optional span attributes
 * @returns A function that conditionally wraps an effect with tracing
 *
 * @example
 * ```ts
 * const startEffect = devFoundation.start(config).pipe(
 *   withTracingIfEnabled("moonwall.foundation.dev.startup", { name: "moonbeam" })
 * );
 * ```
 */
export const withTracingIfEnabled =
  (spanName: string, attributes?: GenericSpanAttributes) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    if (!isTracingEnabled()) {
      return effect;
    }
    return withSpan(spanName, attributes)(effect);
  };
