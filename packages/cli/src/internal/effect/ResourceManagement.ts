/**
 * Resource Management utilities for Effect-based operations.
 *
 * This module provides patterns for guaranteed cleanup of resources even on failure:
 * - Effect.acquireRelease for scoped resource management
 * - Effect.ensuring for cleanup-on-completion patterns
 * - Scoped wrappers for test scenarios requiring automatic cleanup
 *
 * @module ResourceManagement
 */

import { Effect, Scope, Exit } from "effect";
import { createLogger } from "@moonwall/util";

const logger = createLogger({ name: "ResourceManagement" });

// ============================================================================
// Types
// ============================================================================

/**
 * A resource that can be cleaned up.
 * Represents the pattern where start/connect returns {resource, cleanup}.
 */
export interface ManagedResource<A, E> {
  readonly resource: A;
  readonly cleanup: Effect.Effect<void, E>;
}

/**
 * Options for resource acquisition.
 */
export interface AcquireOptions {
  /** Name of the resource for logging */
  readonly resourceName: string;
  /** Whether to suppress cleanup errors (log warning instead of failing) */
  readonly suppressCleanupErrors?: boolean;
  /** Custom cleanup timeout in milliseconds */
  readonly cleanupTimeoutMs?: number;
}

/**
 * Result of running a scoped resource operation.
 */
export interface ScopedResult<A> {
  readonly result: A;
  readonly cleanedUp: boolean;
}

// ============================================================================
// Core Resource Patterns
// ============================================================================

/**
 * Wrap an acquire/release pair with Effect.acquireRelease.
 *
 * The acquired resource will be automatically cleaned up when the scope exits,
 * even if the operation fails or is interrupted.
 *
 * @example
 * ```ts
 * // Automatically clean up process on scope exit
 * const program = Effect.scoped(
 *   Effect.gen(function* () {
 *     const { result: process } = yield* withAcquireRelease(
 *       processManager.launch(config),
 *       (result) => result.cleanup,
 *       { resourceName: "dev-node" }
 *     );
 *     // Process will be cleaned up when scope exits
 *     yield* runTests();
 *     return process;
 *   })
 * );
 * ```
 */
export const withAcquireRelease = <A, E, E2>(
  acquire: Effect.Effect<ManagedResource<A, E2>, E>,
  extractCleanup: (resource: ManagedResource<A, E2>) => Effect.Effect<void, E2>,
  options: AcquireOptions
): Effect.Effect<ManagedResource<A, E2>, E, Scope.Scope> => {
  return Effect.acquireRelease(acquire, (managed, exit) =>
    Effect.gen(function* () {
      const exitType = Exit.isSuccess(exit) ? "success" : "failure";
      logger.debug(`Releasing resource "${options.resourceName}" (exit: ${exitType})`);

      const cleanupEffect = extractCleanup(managed);

      if (options.suppressCleanupErrors) {
        yield* cleanupEffect.pipe(
          Effect.catchAll((error) => {
            logger.warn(
              `Cleanup error for "${options.resourceName}" (suppressed): ${String(error)}`
            );
            return Effect.void;
          })
        );
      } else {
        // Best-effort cleanup - log errors but don't fail the release
        yield* cleanupEffect.pipe(
          Effect.catchAll((error) => {
            logger.error(`Failed to cleanup resource "${options.resourceName}": ${String(error)}`);
            return Effect.void;
          })
        );
      }

      logger.debug(`Resource "${options.resourceName}" released`);
    })
  );
};

/**
 * Ensure cleanup runs after an effect completes, regardless of success/failure.
 *
 * Unlike acquireRelease, this doesn't require a Scope and the cleanup
 * runs immediately after the effect completes. Use this for operations
 * where you want guaranteed cleanup but don't need scoped resource management.
 *
 * @example
 * ```ts
 * // Ensure providers are disconnected even if tests fail
 * const program = withEnsuredCleanup(
 *   Effect.gen(function* () {
 *     const { info, disconnect } = yield* providerService.connect(config);
 *     yield* runTests();
 *     return info;
 *   }),
 *   disconnect,
 *   { resourceName: "providers" }
 * );
 * ```
 */
export const withEnsuredCleanup = <A, E, E2>(
  effect: Effect.Effect<A, E>,
  cleanup: Effect.Effect<void, E2>,
  options: AcquireOptions
): Effect.Effect<A, E | E2> => {
  return effect.pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        logger.debug(`Running ensured cleanup for "${options.resourceName}"`);

        if (options.suppressCleanupErrors) {
          yield* cleanup.pipe(
            Effect.catchAll((error) => {
              logger.warn(
                `Cleanup error for "${options.resourceName}" (suppressed): ${String(error)}`
              );
              return Effect.void;
            })
          );
        } else {
          yield* cleanup.pipe(
            Effect.catchAll((error) => {
              logger.error(
                `Failed to cleanup resource "${options.resourceName}": ${String(error)}`
              );
              return Effect.void;
            })
          );
        }

        logger.debug(`Ensured cleanup completed for "${options.resourceName}"`);
      })
    )
  );
};

/**
 * Run an effect that uses a managed resource with automatic cleanup.
 *
 * This is the most common pattern for test scenarios - acquire a resource,
 * use it, and guarantee cleanup regardless of test outcome.
 *
 * @example
 * ```ts
 * // Run tests with automatic foundation cleanup
 * const testResult = yield* useResource(
 *   devFoundation.start(config),
 *   ({ info }) => runTestsOnPort(info.rpcPort),
 *   { resourceName: "dev-foundation" }
 * );
 * ```
 */
export const useResource = <A, E, B, E2, E3>(
  acquire: Effect.Effect<ManagedResource<A, E3>, E>,
  use: (managed: ManagedResource<A, E3>) => Effect.Effect<B, E2>,
  options: AcquireOptions
): Effect.Effect<B, E | E2 | E3> => {
  return Effect.scoped(
    Effect.gen(function* () {
      const managed = yield* withAcquireRelease(acquire, (m) => m.cleanup, options);
      return yield* use(managed);
    })
  );
};

// ============================================================================
// Process-Specific Patterns
// ============================================================================

/**
 * Spawn a process with guaranteed cleanup on scope exit.
 *
 * Wraps process spawning with acquireRelease to ensure the process
 * is terminated even if subsequent operations fail.
 */
export const withScopedProcess = <A, E>(
  spawnEffect: Effect.Effect<{ result: A; cleanup: Effect.Effect<void, E> }, E>,
  options: Omit<AcquireOptions, "resourceName"> & { processName: string }
): Effect.Effect<A, E, Scope.Scope> => {
  return Effect.gen(function* () {
    const managed = yield* withAcquireRelease(
      spawnEffect.pipe(
        Effect.map(({ result, cleanup }) => ({
          resource: result,
          cleanup,
        }))
      ),
      (m) => m.cleanup,
      { ...options, resourceName: options.processName }
    );
    return managed.resource;
  });
};

/**
 * Run an effect with a spawned process, ensuring cleanup on completion.
 *
 * @example
 * ```ts
 * const testResult = yield* withProcess(
 *   processManager.launch(config),
 *   (processInfo) => Effect.gen(function* () {
 *     yield* waitForReady(processInfo);
 *     return yield* runTests();
 *   }),
 *   { processName: "moonbeam-node" }
 * );
 * // Process is guaranteed to be cleaned up here
 * ```
 */
export const withProcess = <A, E, B, E2>(
  spawnEffect: Effect.Effect<{ result: A; cleanup: Effect.Effect<void, E> }, E>,
  use: (processInfo: A) => Effect.Effect<B, E2>,
  options: Omit<AcquireOptions, "resourceName"> & { processName: string }
): Effect.Effect<B, E | E2> => {
  return Effect.scoped(
    Effect.gen(function* () {
      const processInfo = yield* withScopedProcess(spawnEffect, options);
      return yield* use(processInfo);
    })
  );
};

// ============================================================================
// Provider-Specific Patterns
// ============================================================================

/**
 * Connect providers with guaranteed disconnect on scope exit.
 *
 * Ensures all providers are disconnected even if tests fail midway.
 */
export const withScopedProviders = <Info, E>(
  connectEffect: Effect.Effect<{ info: Info; disconnect: Effect.Effect<void, E> }, E>,
  options: Omit<AcquireOptions, "resourceName"> & { connectionName?: string }
): Effect.Effect<Info, E, Scope.Scope> => {
  return Effect.gen(function* () {
    const managed = yield* withAcquireRelease(
      connectEffect.pipe(
        Effect.map(({ info, disconnect }) => ({
          resource: info,
          cleanup: disconnect,
        }))
      ),
      (m) => m.cleanup,
      { ...options, resourceName: options.connectionName ?? "providers" }
    );
    return managed.resource;
  });
};

/**
 * Run an effect with connected providers, ensuring disconnect on completion.
 *
 * @example
 * ```ts
 * const result = yield* withProviders(
 *   providerService.connect(config),
 *   (info) => Effect.gen(function* () {
 *     const polkadot = yield* providerService.getProvider("polkadot");
 *     return yield* testWithProvider(polkadot);
 *   }),
 *   { connectionName: "test-providers" }
 * );
 * // Providers are guaranteed to be disconnected here
 * ```
 */
export const withProviders = <Info, E, B, E2>(
  connectEffect: Effect.Effect<{ info: Info; disconnect: Effect.Effect<void, E> }, E>,
  use: (info: Info) => Effect.Effect<B, E2>,
  options: Omit<AcquireOptions, "resourceName"> & { connectionName?: string }
): Effect.Effect<B, E | E2> => {
  return Effect.scoped(
    Effect.gen(function* () {
      const info = yield* withScopedProviders(connectEffect, options);
      return yield* use(info);
    })
  );
};

// ============================================================================
// Foundation-Specific Patterns
// ============================================================================

/**
 * Start a foundation with guaranteed stop on scope exit.
 *
 * Wraps foundation start with acquireRelease to ensure the foundation
 * is stopped even if tests fail.
 */
export const withScopedFoundation = <Info, E>(
  startEffect: Effect.Effect<{ info: Info; stop: Effect.Effect<void, E> }, E>,
  options: Omit<AcquireOptions, "resourceName"> & { foundationName: string }
): Effect.Effect<Info, E, Scope.Scope> => {
  return Effect.gen(function* () {
    const managed = yield* withAcquireRelease(
      startEffect.pipe(
        Effect.map(({ info, stop }) => ({
          resource: info,
          cleanup: stop,
        }))
      ),
      (m) => m.cleanup,
      { ...options, resourceName: options.foundationName }
    );
    return managed.resource;
  });
};

/**
 * Run an effect with a started foundation, ensuring stop on completion.
 *
 * This is the primary pattern for test suites that need guaranteed cleanup.
 *
 * @example
 * ```ts
 * // Run chopsticks tests with automatic cleanup
 * const testResult = yield* withFoundation(
 *   chopsticksFoundation.start(config),
 *   (info) => Effect.gen(function* () {
 *     yield* chopsticksFoundation.createBlock({ count: 1 });
 *     return yield* runChopsticksTests(info.wsPort);
 *   }),
 *   { foundationName: "chopsticks-moonbeam" }
 * );
 * // Chopsticks is guaranteed to be stopped here
 * ```
 */
export const withFoundation = <Info, E, B, E2>(
  startEffect: Effect.Effect<{ info: Info; stop: Effect.Effect<void, E> }, E>,
  use: (info: Info) => Effect.Effect<B, E2>,
  options: Omit<AcquireOptions, "resourceName"> & { foundationName: string }
): Effect.Effect<B, E | E2> => {
  return Effect.scoped(
    Effect.gen(function* () {
      const info = yield* withScopedFoundation(startEffect, options);
      return yield* use(info);
    })
  );
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Combine multiple cleanup effects into one.
 *
 * Runs all cleanups in parallel, collecting errors without short-circuiting.
 * This ensures all resources are attempted to be cleaned up even if some fail.
 */
export const combineCleanups = <E>(
  cleanups: ReadonlyArray<{ name: string; cleanup: Effect.Effect<void, E> }>
): Effect.Effect<void, E> => {
  return Effect.gen(function* () {
    const results = yield* Effect.all(
      cleanups.map(({ name, cleanup }) =>
        cleanup.pipe(
          Effect.map(() => ({ name, success: true as const })),
          Effect.catchAll((error) =>
            Effect.succeed({
              name,
              success: false as const,
              error: String(error),
            })
          )
        )
      ),
      { concurrency: "unbounded" }
    );

    const failures = results.filter((r) => !r.success);

    if (failures.length > 0) {
      const failedNames = failures.map((f) => f.name).join(", ");
      logger.error(`Failed to cleanup resources: ${failedNames}`);
      // Don't fail - cleanup errors shouldn't propagate
    }

    const successes = results.filter((r) => r.success);
    if (successes.length > 0) {
      logger.debug(`Successfully cleaned up: ${successes.map((s) => s.name).join(", ")}`);
    }
  });
};

/**
 * Create a cleanup effect that runs on process exit.
 *
 * Registers signal handlers to ensure cleanup runs on SIGINT/SIGTERM.
 * Returns a finalizer that should be called to unregister the handlers.
 */
export const registerProcessExitCleanup = <E>(
  cleanup: Effect.Effect<void, E>,
  options: { resourceName: string }
): Effect.Effect<() => void> => {
  return Effect.sync(() => {
    const handler = () => {
      logger.info(`Process exit signal received, cleaning up "${options.resourceName}"...`);
      Effect.runPromise(
        cleanup.pipe(
          Effect.catchAll((error) => {
            logger.error(`Cleanup failed on exit for "${options.resourceName}": ${String(error)}`);
            return Effect.void;
          })
        )
      ).then(() => {
        logger.debug(`Cleanup completed for "${options.resourceName}" on exit`);
        process.exit(0);
      });
    };

    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);

    // Return unregister function
    return () => {
      process.off("SIGINT", handler);
      process.off("SIGTERM", handler);
    };
  });
};

/**
 * Type guard to check if an error occurred during cleanup.
 */
export const isCleanupError = (
  error: unknown
): error is { _tag: "CleanupError"; resourceName: string; cause: unknown } => {
  return (
    typeof error === "object" && error !== null && "_tag" in error && error._tag === "CleanupError"
  );
};
