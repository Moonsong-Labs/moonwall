/**
 * Effect-based extrinsic helper functions
 *
 * This module provides Effect versions of extrinsic operations from extrinsics.ts.
 * Each function returns an Effect that can be composed with other Effects.
 *
 * For backwards compatibility, use the original functions from extrinsics.ts
 * which remain Promise-based.
 */
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import type { ISubmittableResult } from "@polkadot/types/types";
import type { KeyringPair } from "@polkadot/keyring/types";
import { Data, Effect } from "effect";
import { alith } from "../constants";

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error when signing an extrinsic fails
 */
export class ExtrinsicSignError extends Data.TaggedError("ExtrinsicSignError")<{
  readonly message: string;
  readonly account: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when submitting an extrinsic fails
 */
export class ExtrinsicSubmitError extends Data.TaggedError("ExtrinsicSubmitError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when extrinsic execution fails on chain
 */
export class ExtrinsicExecutionError extends Data.TaggedError("ExtrinsicExecutionError")<{
  readonly message: string;
  readonly status: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when extrinsic times out waiting for finalization
 */
export class ExtrinsicTimeoutError extends Data.TaggedError("ExtrinsicTimeoutError")<{
  readonly message: string;
  readonly timeoutMs: number;
}> {}

// ============================================================================
// Result Types
// ============================================================================

export interface SignAndSendResult {
  /** Whether the extrinsic was included in a block */
  inBlock: boolean;
  /** Whether the extrinsic was finalized */
  finalized: boolean;
  /** The block hash where the extrinsic was included (if available) */
  blockHash?: string;
}

// ============================================================================
// Effect-based Extrinsic Operations
// ============================================================================

/**
 * Signs and sends an extrinsic, waiting for finalization.
 *
 * @param tx - The submittable extrinsic to sign and send
 * @param account - The keyring pair to sign with (default: alith)
 * @param nonce - The nonce to use (default: -1 for auto)
 * @returns Effect that resolves when the extrinsic is finalized
 *
 * @example
 * ```ts
 * const result = await Effect.runPromise(
 *   signAndSendEffect(api.tx.balances.transfer(dest, amount), alith)
 * );
 * if (result.finalized) {
 *   console.log(`Transfer finalized in block ${result.blockHash}`);
 * }
 * ```
 */
export const signAndSendEffect = (
  tx: SubmittableExtrinsic<"promise", ISubmittableResult>,
  account: KeyringPair = alith,
  nonce = -1
): Effect.Effect<SignAndSendResult, ExtrinsicSubmitError> =>
  Effect.async<SignAndSendResult, ExtrinsicSubmitError>((resume) => {
    let unsubscribe: (() => void) | undefined;
    let isResolved = false;

    tx.signAndSend(account, { nonce }, ({ status }) => {
      if (isResolved) return;

      if (status.isInBlock) {
        process.stdout.write(
          "Extrinsic submitted and included in block, waiting for finalization..."
        );
      }

      if (status.isFinalized) {
        isResolved = true;
        process.stdout.write("✅\n");
        resume(
          Effect.succeed({
            inBlock: true,
            finalized: true,
            blockHash: status.asFinalized.toString(),
          })
        );
        if (unsubscribe) unsubscribe();
      }
    })
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((error) => {
        if (!isResolved) {
          isResolved = true;
          resume(
            Effect.fail(
              new ExtrinsicSubmitError({
                message: `Failed to sign and send extrinsic: ${error instanceof Error ? error.message : String(error)}`,
                cause: error,
              })
            )
          );
        }
      });

    // Return cleanup function
    return Effect.sync(() => {
      isResolved = true;
      if (unsubscribe) unsubscribe();
    });
  });

/**
 * Signs and sends an extrinsic, waiting only for block inclusion (not finalization).
 * This is faster than signAndSendEffect but provides weaker guarantees.
 *
 * @param tx - The submittable extrinsic to sign and send
 * @param account - The keyring pair to sign with (default: alith)
 * @param nonce - The nonce to use (default: -1 for auto)
 * @returns Effect that resolves when the extrinsic is included in a block
 *
 * @example
 * ```ts
 * const result = await Effect.runPromise(
 *   signAndSendInBlockEffect(api.tx.balances.transfer(dest, amount), alith)
 * );
 * console.log(`Transfer included in block ${result.blockHash}`);
 * ```
 */
export const signAndSendInBlockEffect = (
  tx: SubmittableExtrinsic<"promise", ISubmittableResult>,
  account: KeyringPair = alith,
  nonce = -1
): Effect.Effect<SignAndSendResult, ExtrinsicSubmitError> =>
  Effect.async<SignAndSendResult, ExtrinsicSubmitError>((resume) => {
    let unsubscribe: (() => void) | undefined;
    let isResolved = false;

    tx.signAndSend(account, { nonce }, ({ status }) => {
      if (isResolved) return;

      if (status.isInBlock) {
        isResolved = true;
        resume(
          Effect.succeed({
            inBlock: true,
            finalized: false,
            blockHash: status.asInBlock.toString(),
          })
        );
        if (unsubscribe) unsubscribe();
      }
    })
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((error) => {
        if (!isResolved) {
          isResolved = true;
          resume(
            Effect.fail(
              new ExtrinsicSubmitError({
                message: `Failed to sign and send extrinsic: ${error instanceof Error ? error.message : String(error)}`,
                cause: error,
              })
            )
          );
        }
      });

    return Effect.sync(() => {
      isResolved = true;
      if (unsubscribe) unsubscribe();
    });
  });

/**
 * Signs and sends an extrinsic with a timeout.
 * If the extrinsic is not finalized within the timeout, returns a timeout error.
 *
 * @param tx - The submittable extrinsic to sign and send
 * @param account - The keyring pair to sign with (default: alith)
 * @param nonce - The nonce to use (default: -1 for auto)
 * @param timeoutMs - Timeout in milliseconds (default: 60000)
 * @returns Effect that resolves when the extrinsic is finalized or times out
 *
 * @example
 * ```ts
 * const result = await Effect.runPromise(
 *   signAndSendWithTimeoutEffect(
 *     api.tx.balances.transfer(dest, amount),
 *     alith,
 *     -1,
 *     30000 // 30 second timeout
 *   )
 * );
 * ```
 */
export const signAndSendWithTimeoutEffect = (
  tx: SubmittableExtrinsic<"promise", ISubmittableResult>,
  account: KeyringPair = alith,
  nonce = -1,
  timeoutMs = 60000
): Effect.Effect<SignAndSendResult, ExtrinsicSubmitError | ExtrinsicTimeoutError> =>
  Effect.timeoutFail(signAndSendEffect(tx, account, nonce), {
    duration: timeoutMs,
    onTimeout: () =>
      new ExtrinsicTimeoutError({
        message: `Extrinsic did not finalize within ${timeoutMs}ms`,
        timeoutMs,
      }),
  });
