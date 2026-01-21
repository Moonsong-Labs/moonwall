import { Duration, Schedule } from "effect";

/**
 * Centralized retry policies for network operations.
 *
 * This module provides consistent retry strategies across all Effect services
 * in Moonwall. Using centralized policies ensures:
 * - Consistent retry behavior across services
 * - Easier tuning of retry parameters
 * - Better observability of retry patterns
 *
 * All policies use exponential backoff with jitter to prevent thundering herd
 * problems when multiple services retry simultaneously.
 */

/**
 * Configuration for retry policies
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  readonly maxAttempts: number;
  /** Initial delay before first retry */
  readonly baseDelay: Duration.DurationInput;
  /** Maximum delay between retries (caps exponential growth) */
  readonly maxDelay?: Duration.DurationInput;
  /** Factor by which delay increases (default: 2 for exponential) */
  readonly factor?: number;
}

/**
 * Default retry configuration values used across services
 */
export const RetryDefaults = {
  /** Default maximum attempts for network operations */
  maxAttempts: 200,
  /** Default base delay for exponential backoff */
  baseDelay: Duration.millis(50),
  /** Default maximum delay cap */
  maxDelay: Duration.seconds(5),
  /** Default exponential factor */
  factor: 2,
} as const;

/**
 * Type alias for retry schedule - the output type varies based on composition
 * but Effect.retry only cares about the input error type.
 */
export type RetrySchedule<E = unknown> = Schedule.Schedule<unknown, E, never>;

/**
 * Creates an exponential backoff schedule with jitter.
 *
 * The schedule:
 * 1. Starts with baseDelay
 * 2. Doubles the delay each retry (or uses custom factor)
 * 3. Caps delay at maxDelay
 * 4. Adds jitter (0.8x to 1.2x) to prevent thundering herd
 * 5. Stops after maxAttempts
 *
 * @example
 * ```ts
 * const policy = createExponentialRetryPolicy({
 *   maxAttempts: 10,
 *   baseDelay: "100 millis",
 *   maxDelay: "5 seconds",
 * });
 *
 * // Usage with Effect.retry
 * Effect.retry(fetchData, policy);
 * ```
 */
export const createExponentialRetryPolicy = <E = unknown>(
  config: Partial<RetryConfig> = {}
): RetrySchedule<E> => {
  const maxAttempts = config.maxAttempts ?? RetryDefaults.maxAttempts;
  const baseDelay = config.baseDelay ?? RetryDefaults.baseDelay;
  const maxDelay = config.maxDelay ?? RetryDefaults.maxDelay;
  const factor = config.factor ?? RetryDefaults.factor;

  // Combine exponential backoff with:
  // - Union with spaced schedule to cap max delay
  // - Intersection with recurs to limit attempts
  // - Jitter to prevent thundering herd
  return Schedule.exponential(baseDelay, factor).pipe(
    Schedule.union(Schedule.spaced(maxDelay)),
    Schedule.intersect(Schedule.recurs(maxAttempts - 1)),
    Schedule.jittered
  );
};

/**
 * Network operation retry policy with exponential backoff.
 *
 * Used for: provider connections, WebSocket operations, RPC calls
 *
 * Timing: 50ms -> 100ms -> 200ms -> 400ms -> 800ms -> 1.6s -> 3.2s -> 5s (capped)
 * Max attempts: 200 (approximately 100+ seconds total with caps)
 */
export const networkRetryPolicy = <E = unknown>(): RetrySchedule<E> =>
  Schedule.exponential(RetryDefaults.baseDelay, RetryDefaults.factor).pipe(
    Schedule.union(Schedule.spaced(RetryDefaults.maxDelay)),
    Schedule.intersect(Schedule.recurs(RetryDefaults.maxAttempts - 1)),
    Schedule.jittered
  );

/**
 * Fast retry policy for port discovery operations.
 *
 * Port discovery needs rapid retries since nodes may start quickly.
 * Uses shorter max delay but same exponential curve initially.
 *
 * Timing: 50ms -> 100ms -> 200ms -> 400ms -> 500ms (capped early)
 * Max attempts: 1200 (approximately 600+ seconds with caps)
 */
export const portDiscoveryRetryPolicy = <E = unknown>(): RetrySchedule<E> =>
  Schedule.exponential(Duration.millis(50), 2).pipe(
    Schedule.union(Schedule.spaced(Duration.millis(500))), // Lower cap for fast polling
    Schedule.intersect(Schedule.recurs(1199)), // Default 1200 attempts
    Schedule.jittered
  );

/**
 * Health check retry policy for RPC operations.
 *
 * Health checks need moderate retry with reasonable timeouts.
 *
 * Timing: 100ms -> 200ms -> 400ms -> 800ms -> 1s (capped)
 * Max attempts: 30 (approximately 30+ seconds total)
 */
export const healthCheckRetryPolicy = <E = unknown>(): RetrySchedule<E> =>
  Schedule.exponential(Duration.millis(100), 2).pipe(
    Schedule.union(Schedule.spaced(Duration.seconds(1))),
    Schedule.intersect(Schedule.recurs(29)), // 30 total attempts
    Schedule.jittered
  );

/**
 * Provider connection retry policy.
 *
 * Provider connections need patience - external RPCs may be slow.
 * Uses longer base delay and higher cap.
 *
 * Timing: 100ms -> 200ms -> 400ms -> 800ms -> 1.6s -> 3.2s -> 5s (capped)
 * Max attempts: 150 (matches existing moonwall behavior)
 */
export const providerConnectionRetryPolicy = <E = unknown>(): RetrySchedule<E> =>
  Schedule.exponential(Duration.millis(100), 2).pipe(
    Schedule.union(Schedule.spaced(Duration.seconds(5))),
    Schedule.intersect(Schedule.recurs(149)), // 150 total attempts
    Schedule.jittered
  );

/**
 * WebSocket reconnection retry policy.
 *
 * WebSocket reconnection during node readiness checks.
 * Fast initial retries, then backs off.
 *
 * Timing: 50ms -> 100ms -> 200ms -> 400ms -> 800ms -> 1s (capped)
 * Max attempts: 200 (approximately 200+ seconds total)
 */
export const webSocketRetryPolicy = <E = unknown>(): RetrySchedule<E> =>
  Schedule.exponential(Duration.millis(50), 2).pipe(
    Schedule.union(Schedule.spaced(Duration.seconds(1))),
    Schedule.intersect(Schedule.recurs(199)), // 200 total attempts
    Schedule.jittered
  );

/**
 * Creates a configurable retry policy with exponential backoff and jitter.
 *
 * This is the recommended way to create custom retry policies for
 * operations not covered by the pre-defined policies above.
 *
 * @param maxAttempts Maximum number of attempts (including first try)
 * @param baseDelay Initial delay before first retry
 * @param maxDelay Maximum delay cap (prevents unbounded exponential growth)
 * @param factor Exponential growth factor (default: 2)
 *
 * @example
 * ```ts
 * // Custom policy: 3 retries, starting at 200ms, max 2s
 * const customPolicy = makeRetryPolicy(3, "200 millis", "2 seconds");
 *
 * yield* Effect.retry(operation, customPolicy);
 * ```
 */
export const makeRetryPolicy = <E = unknown>(
  maxAttempts: number,
  baseDelay: Duration.DurationInput = "100 millis",
  maxDelay: Duration.DurationInput = "5 seconds",
  factor = 2
): RetrySchedule<E> =>
  Schedule.exponential(baseDelay, factor).pipe(
    Schedule.union(Schedule.spaced(maxDelay)),
    Schedule.intersect(Schedule.recurs(maxAttempts - 1)),
    Schedule.jittered
  );
