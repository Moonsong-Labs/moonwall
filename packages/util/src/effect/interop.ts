import { Effect, Runtime, Exit } from "effect";
import { MoonwallError, toMoonwallError } from "@moonwall/types";

/**
 * Default runtime for running Effect programs
 */
const defaultRuntime = Runtime.defaultRuntime;

/**
 * Converts a Promise to an Effect with proper error handling
 * @param promise - The Promise to convert
 * @param mapError - Optional function to map errors to Moonwall errors
 * @returns Effect that represents the Promise
 */
export const promiseToEffect = <A, E = MoonwallError>(
  promise: Promise<A>,
  mapError?: (error: unknown) => E
): Effect.Effect<A, E, never> =>
  Effect.tryPromise({
    try: () => promise,
    catch: mapError || ((error) => toMoonwallError(error) as E),
  });

/**
 * Converts an Effect to a Promise for backward compatibility
 * @param effect - The Effect to convert
 * @param runtime - Optional runtime to use (defaults to defaultRuntime)
 * @returns Promise that represents the Effect
 */
export const effectToPromise = <A, E>(
  effect: Effect.Effect<A, E, never>,
  runtime: Runtime.Runtime<never> = defaultRuntime
): Promise<A> => Runtime.runPromise(runtime)(effect);

/**
 * Runs an Effect and returns a Promise, with proper error handling
 * This is the main function for backward compatibility with existing Promise-based APIs
 * @param effect - The Effect to run
 * @param runtime - Optional runtime to use
 * @returns Promise that resolves with the Effect result or rejects with the error
 */
export const runPromiseEffect = <A, E>(
  effect: Effect.Effect<A, E, never>,
  runtime: Runtime.Runtime<never> = defaultRuntime
): Promise<A> => {
  return Runtime.runPromise(runtime)(effect);
};

/**
 * Runs an Effect and returns a Promise that never rejects
 * Instead, it returns an Exit object that represents success or failure
 * @param effect - The Effect to run
 * @param runtime - Optional runtime to use
 * @returns Promise that always resolves with an Exit object
 */
export const runPromiseExit = <A, E>(
  effect: Effect.Effect<A, E, never>,
  runtime: Runtime.Runtime<never> = defaultRuntime
): Promise<Exit.Exit<A, E>> => {
  return Runtime.runPromiseExit(runtime)(effect);
};

/**
 * Wraps a function that returns a Promise to return an Effect instead
 * Useful for converting existing async functions to Effect-based functions
 * @param fn - The async function to wrap
 * @param mapError - Optional function to map errors
 * @returns Function that returns an Effect
 */
export const wrapAsyncFunction =
  <Args extends readonly unknown[], A, E = MoonwallError>(
    fn: (...args: Args) => Promise<A>,
    mapError?: (error: unknown) => E
  ) =>
  (...args: Args): Effect.Effect<A, E, never> =>
    promiseToEffect(fn(...args), mapError);

/**
 * Wraps an Effect-based function to return a Promise for backward compatibility
 * @param fn - The Effect-based function to wrap
 * @param runtime - Optional runtime to use
 * @returns Function that returns a Promise
 */
export const wrapEffectFunction =
  <Args extends readonly unknown[], A, E>(
    fn: (...args: Args) => Effect.Effect<A, E, never>,
    runtime: Runtime.Runtime<never> = defaultRuntime
  ) =>
  (...args: Args): Promise<A> =>
    runPromiseEffect(fn(...args), runtime);

/**
 * Creates a function that can be called with either Effect or Promise semantics
 * @param effectFn - The Effect-based implementation
 * @param runtime - Optional runtime to use for Promise conversion
 * @returns Object with both Effect and Promise versions
 */
export const createDualFunction = <Args extends readonly unknown[], A, E>(
  effectFn: (...args: Args) => Effect.Effect<A, E, never>,
  runtime: Runtime.Runtime<never> = defaultRuntime
) => ({
  effect: effectFn,
  promise: wrapEffectFunction(effectFn, runtime),
});

/**
 * Utility for handling callbacks that expect Promises but need to work with Effects
 * @param effect - The Effect to convert
 * @param callback - Callback that expects a Promise
 * @param runtime - Optional runtime to use
 */
export const withPromiseCallback = <A, E>(
  effect: Effect.Effect<A, E, never>,
  callback: (promise: Promise<A>) => void,
  runtime: Runtime.Runtime<never> = defaultRuntime
): void => {
  callback(runPromiseEffect(effect, runtime));
};

/**
 * Testing utilities for Effect-based functions
 */
export const testUtils = {
  /**
   * Runs an Effect in tests and returns the result or throws the error
   * @param effect - The Effect to test
   * @param runtime - Optional runtime to use
   * @returns Promise that resolves with the result or rejects with the error
   */
  runEffect: <A, E>(
    effect: Effect.Effect<A, E, never>,
    runtime: Runtime.Runtime<never> = defaultRuntime
  ): Promise<A> => runPromiseEffect(effect, runtime),

  /**
   * Runs an Effect in tests and expects it to succeed
   * @param effect - The Effect to test
   * @param runtime - Optional runtime to use
   * @returns Promise that resolves with the result
   */
  expectSuccess: async <A, E>(
    effect: Effect.Effect<A, E, never>,
    runtime: Runtime.Runtime<never> = defaultRuntime
  ): Promise<A> => {
    const exit = await runPromiseExit(effect, runtime);
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }
    throw new Error(`Expected success but got failure: ${JSON.stringify(exit.cause)}`);
  },

  /**
   * Runs an Effect in tests and expects it to fail
   * @param effect - The Effect to test
   * @param runtime - Optional runtime to use
   * @returns Promise that resolves with the error
   */
  expectFailure: async <A, E>(
    effect: Effect.Effect<A, E, never>,
    runtime: Runtime.Runtime<never> = defaultRuntime
  ): Promise<E> => {
    const exit = await runPromiseExit(effect, runtime);
    if (Exit.isFailure(exit)) {
      // Extract the actual error from the cause
      const cause = exit.cause;
      if (cause._tag === "Fail") {
        return cause.error;
      }
      if (cause._tag === "Die") {
        throw cause.defect;
      }
      throw new Error(`Unexpected cause type: ${cause._tag}`);
    }
    throw new Error(`Expected failure but got success: ${JSON.stringify(exit.value)}`);
  },

  /**
   * Creates a mock Effect that resolves with the given value
   * @param value - The value to resolve with
   * @returns Effect that succeeds with the value
   */
  mockSuccess: <A>(value: A): Effect.Effect<A, never, never> => Effect.succeed(value),

  /**
   * Creates a mock Effect that fails with the given error
   * @param error - The error to fail with
   * @returns Effect that fails with the error
   */
  mockFailure: <E>(error: E): Effect.Effect<never, E, never> => Effect.fail(error),

  /**
   * Creates a mock Effect that delays for the given duration then succeeds
   * @param value - The value to resolve with
   * @param delay - The delay in milliseconds
   * @returns Effect that succeeds after the delay
   */
  mockDelayedSuccess: <A>(value: A, delay: number): Effect.Effect<A, never, never> =>
    Effect.delay(Effect.succeed(value), `${delay} millis`),

  /**
   * Creates a mock Effect that delays for the given duration then fails
   * @param error - The error to fail with
   * @param delay - The delay in milliseconds
   * @returns Effect that fails after the delay
   */
  mockDelayedFailure: <E>(error: E, delay: number): Effect.Effect<never, E, never> =>
    Effect.delay(Effect.fail(error), `${delay} millis`),
};

/**
 * Batch processing utilities for converting between Promise and Effect patterns
 */
export const batchUtils = {
  /**
   * Converts an array of Promises to an Effect that runs them all in parallel
   * @param promises - Array of Promises to convert
   * @param mapError - Optional function to map errors
   * @returns Effect that resolves with array of results
   */
  promisesToEffect: <A, E = MoonwallError>(
    promises: Promise<A>[],
    mapError?: (error: unknown) => E
  ): Effect.Effect<A[], E, never> =>
    Effect.all(
      promises.map((p) => promiseToEffect(p, mapError)),
      { concurrency: "unbounded" }
    ),

  /**
   * Converts an array of Effects to a Promise that runs them all in parallel
   * @param effects - Array of Effects to convert
   * @param runtime - Optional runtime to use
   * @returns Promise that resolves with array of results
   */
  effectsToPromise: <A, E>(
    effects: Effect.Effect<A, E, never>[],
    runtime: Runtime.Runtime<never> = defaultRuntime
  ): Promise<A[]> => runPromiseEffect(Effect.all(effects, { concurrency: "unbounded" }), runtime),

  /**
   * Runs Effects in sequence (one after another) and returns a Promise
   * @param effects - Array of Effects to run sequentially
   * @param runtime - Optional runtime to use
   * @returns Promise that resolves with array of results
   */
  runSequential: <A, E>(
    effects: Effect.Effect<A, E, never>[],
    runtime: Runtime.Runtime<never> = defaultRuntime
  ): Promise<A[]> => runPromiseEffect(Effect.all(effects, { concurrency: 1 }), runtime),
};
