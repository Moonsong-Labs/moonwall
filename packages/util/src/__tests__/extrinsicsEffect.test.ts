import { describe, expect, it, mock } from "bun:test";
import { Effect } from "effect";
import {
  ExtrinsicSignError,
  ExtrinsicSubmitError,
  ExtrinsicExecutionError,
  ExtrinsicTimeoutError,
  signAndSendEffect,
  signAndSendInBlockEffect,
  signAndSendWithTimeoutEffect,
  type SignAndSendResult,
} from "../functions/extrinsicsEffect";

// ============================================================================
// Error Type Tests
// ============================================================================

describe("extrinsicsEffect error types", () => {
  it("should create ExtrinsicSignError with correct properties", () => {
    const error = new ExtrinsicSignError({
      message: "Failed to sign",
      account: "0x123",
      cause: new Error("Signing failed"),
    });
    expect(error._tag).toBe("ExtrinsicSignError");
    expect(error.message).toBe("Failed to sign");
    expect(error.account).toBe("0x123");
  });

  it("should create ExtrinsicSubmitError with correct properties", () => {
    const error = new ExtrinsicSubmitError({
      message: "Failed to submit",
      cause: new Error("Network error"),
    });
    expect(error._tag).toBe("ExtrinsicSubmitError");
    expect(error.message).toBe("Failed to submit");
  });

  it("should create ExtrinsicExecutionError with correct properties", () => {
    const error = new ExtrinsicExecutionError({
      message: "Execution failed",
      status: "Invalid",
    });
    expect(error._tag).toBe("ExtrinsicExecutionError");
    expect(error.status).toBe("Invalid");
  });

  it("should create ExtrinsicTimeoutError with correct properties", () => {
    const error = new ExtrinsicTimeoutError({
      message: "Timed out",
      timeoutMs: 30000,
    });
    expect(error._tag).toBe("ExtrinsicTimeoutError");
    expect(error.timeoutMs).toBe(30000);
  });
});

// ============================================================================
// Mock Transaction Factory
// ============================================================================

const createMockTx = (
  options: {
    shouldFail?: boolean;
    finalizeDelay?: number;
    inBlockDelay?: number;
    errorMessage?: string;
  } = {}
) => {
  const {
    shouldFail = false,
    finalizeDelay = 0,
    inBlockDelay = 0,
    errorMessage = "Mock error",
  } = options;

  return {
    signAndSend: mock(
      (account: unknown, opts: unknown, callback: (result: { status: any }) => void) => {
        if (shouldFail) {
          return Promise.reject(new Error(errorMessage));
        }

        // Simulate async status updates
        setTimeout(() => {
          callback({
            status: {
              isInBlock: true,
              asInBlock: { toString: () => "0xinblockhash" },
              isFinalized: false,
            },
          });
        }, inBlockDelay);

        setTimeout(() => {
          callback({
            status: {
              isInBlock: false,
              isFinalized: true,
              asFinalized: { toString: () => "0xfinalizedhash" },
            },
          });
        }, inBlockDelay + finalizeDelay);

        // Return unsubscribe function
        return Promise.resolve(() => {});
      }
    ),
  } as any;
};

const createMockAccount = () =>
  ({
    address: "0xmockaccount",
    sign: mock(() => new Uint8Array()),
  }) as any;

// ============================================================================
// signAndSendEffect Tests
// ============================================================================

describe("signAndSendEffect", () => {
  it("should resolve with finalized result on success", async () => {
    const mockTx = createMockTx({ finalizeDelay: 10 });
    const mockAccount = createMockAccount();

    const result = await Effect.runPromise(signAndSendEffect(mockTx, mockAccount));

    expect(result.finalized).toBe(true);
    expect(result.inBlock).toBe(true);
    expect(result.blockHash).toBe("0xfinalizedhash");
  });

  it("should fail with ExtrinsicSubmitError on signAndSend failure", async () => {
    const mockTx = createMockTx({ shouldFail: true, errorMessage: "Network error" });
    const mockAccount = createMockAccount();

    const result = await Effect.runPromiseExit(signAndSendEffect(mockTx, mockAccount));

    expect(result._tag).toBe("Failure");
  });
});

// ============================================================================
// signAndSendInBlockEffect Tests
// ============================================================================

describe("signAndSendInBlockEffect", () => {
  it("should resolve when extrinsic is in block (before finalization)", async () => {
    const mockTx = createMockTx({ inBlockDelay: 5, finalizeDelay: 100 });
    const mockAccount = createMockAccount();

    const result = await Effect.runPromise(signAndSendInBlockEffect(mockTx, mockAccount));

    expect(result.inBlock).toBe(true);
    expect(result.finalized).toBe(false);
    expect(result.blockHash).toBe("0xinblockhash");
  });

  it("should fail with ExtrinsicSubmitError on signAndSend failure", async () => {
    const mockTx = createMockTx({ shouldFail: true });
    const mockAccount = createMockAccount();

    const result = await Effect.runPromiseExit(signAndSendInBlockEffect(mockTx, mockAccount));

    expect(result._tag).toBe("Failure");
  });
});

// ============================================================================
// signAndSendWithTimeoutEffect Tests
// ============================================================================

describe("signAndSendWithTimeoutEffect", () => {
  it("should resolve within timeout", async () => {
    const mockTx = createMockTx({ finalizeDelay: 10 });
    const mockAccount = createMockAccount();

    const result = await Effect.runPromise(
      signAndSendWithTimeoutEffect(mockTx, mockAccount, -1, 5000)
    );

    expect(result.finalized).toBe(true);
  });

  it("should fail with ExtrinsicTimeoutError when timeout exceeded", async () => {
    // Create a transaction that takes longer than the timeout
    const mockTx = createMockTx({ finalizeDelay: 1000 });
    const mockAccount = createMockAccount();

    const result = await Effect.runPromiseExit(
      signAndSendWithTimeoutEffect(mockTx, mockAccount, -1, 50)
    );

    expect(result._tag).toBe("Failure");
  });
});

// ============================================================================
// Effect Composition Tests
// ============================================================================

describe("Effect composition with extrinsics", () => {
  it("should allow chaining extrinsic operations", async () => {
    const mockTx1 = createMockTx({ finalizeDelay: 5 });
    const mockTx2 = createMockTx({ finalizeDelay: 5 });
    const mockAccount = createMockAccount();

    const program = Effect.gen(function* () {
      const result1 = yield* signAndSendEffect(mockTx1, mockAccount);
      const result2 = yield* signAndSendEffect(mockTx2, mockAccount);
      return { result1, result2 };
    });

    const result = await Effect.runPromise(program);

    expect(result.result1.finalized).toBe(true);
    expect(result.result2.finalized).toBe(true);
  });

  it("should allow catching and recovering from extrinsic errors", async () => {
    const mockTx = createMockTx({ shouldFail: true });
    const mockAccount = createMockAccount();

    const program = Effect.catchAll(signAndSendEffect(mockTx, mockAccount), (error) =>
      Effect.succeed({
        inBlock: false,
        finalized: false,
        errorTag: error._tag,
      })
    );

    const result = await Effect.runPromise(program);
    expect(result.finalized).toBe(false);
    expect((result as { errorTag?: string }).errorTag).toBe("ExtrinsicSubmitError");
  });

  it("should allow parallel extrinsic submission", async () => {
    const mockTx1 = createMockTx({ finalizeDelay: 10 });
    const mockTx2 = createMockTx({ finalizeDelay: 10 });
    const mockAccount = createMockAccount();

    const program = Effect.all([
      signAndSendEffect(mockTx1, mockAccount),
      signAndSendEffect(mockTx2, mockAccount),
    ]);

    const results = await Effect.runPromise(program);

    expect(results).toHaveLength(2);
    expect(results[0].finalized).toBe(true);
    expect(results[1].finalized).toBe(true);
  });
});
