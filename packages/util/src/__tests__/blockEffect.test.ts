import { describe, expect, it, mock, beforeEach } from "bun:test";
import { Effect } from "effect";
import {
  BlockCreationError,
  BlockFinalizationError,
  BlockLookupError,
  ExtrinsicLookupError,
  HistoricBlockError,
  RuntimeUpgradeCheckError,
  createAndFinalizeBlockEffect,
  checkBlockFinalizedEffect,
  getBlockExtrinsicEffect,
  fetchHistoricBlockNumEffect,
  checkTimeSliceForUpgradesEffect,
  type CreateBlockResult,
  type BlockFinalizedResult,
  type BlockExtrinsicResult,
  type RuntimeUpgradeResult,
} from "../functions/blockEffect";

// ============================================================================
// Mock API Factory
// ============================================================================

const createMockApi = (overrides: Record<string, unknown> = {}) => {
  const defaultApi = {
    rpc: mock(() => Promise.resolve({ hash: "0x123abc", proof_size: 100 })),
    at: mock(() =>
      Promise.resolve({
        query: {
          system: {
            events: mock(() =>
              Promise.resolve([
                {
                  phase: { isApplyExtrinsic: true, asApplyExtrinsic: { eq: () => true } },
                  event: { section: "system", method: "ExtrinsicSuccess" },
                },
              ])
            ),
            lastRuntimeUpgrade: mock(() =>
              Promise.resolve({
                unwrap: () => ({ specVersion: { eq: () => false, toNumber: () => 1000 } }),
              })
            ),
          },
        },
      })
    ),
    _rpcCore: {
      provider: {
        send: mock(() => Promise.resolve(true)),
      },
    },
  };

  // Type-safe chain mock
  const chainMock = {
    getBlock: mock(() =>
      Promise.resolve({
        block: {
          extrinsics: [
            {
              method: {
                section: "timestamp",
                method: "set",
                args: [{ toNumber: () => Date.now() }],
              },
            },
            { method: { section: "balances", method: "transfer" } },
          ],
          header: { number: { toNumber: () => 1000 } },
        },
      })
    ),
    getBlockHash: mock(() => Promise.resolve("0xblockhash")),
    getFinalizedHead: mock(() => Promise.resolve("0xfinalizedhash")),
  };

  return {
    ...defaultApi,
    rpc: {
      ...defaultApi.rpc,
      chain: chainMock,
      // Allow direct call for engine_createBlock
      ...(hash?: string) =>
        hash
          ? Promise.resolve({ hash: "0x123abc", proof_size: 100 })
          : Promise.resolve({ hash: "0x123abc", proof_size: 100 }),
    },
    ...overrides,
  };
};

// ============================================================================
// Error Type Tests
// ============================================================================

describe("blockEffect error types", () => {
  it("should create BlockCreationError with correct properties", () => {
    const error = new BlockCreationError({
      message: "Failed to create block",
      parentHash: "0xparent",
      cause: new Error("RPC error"),
    });
    expect(error._tag).toBe("BlockCreationError");
    expect(error.message).toBe("Failed to create block");
    expect(error.parentHash).toBe("0xparent");
    expect(error.cause).toBeInstanceOf(Error);
  });

  it("should create BlockLookupError with correct properties", () => {
    const error = new BlockLookupError({
      message: "Block not found",
      blockHash: "0xhash",
      cause: new Error("Not found"),
    });
    expect(error._tag).toBe("BlockLookupError");
    expect(error.blockHash).toBe("0xhash");
  });

  it("should create ExtrinsicLookupError with correct properties", () => {
    const error = new ExtrinsicLookupError({
      message: "Extrinsic not found",
      blockHash: "0xhash",
      section: "balances",
      method: "transfer",
    });
    expect(error._tag).toBe("ExtrinsicLookupError");
    expect(error.section).toBe("balances");
    expect(error.method).toBe("transfer");
  });

  it("should create BlockFinalizationError with correct properties", () => {
    const error = new BlockFinalizationError({
      message: "Finalization check failed",
      blockNumber: 100,
    });
    expect(error._tag).toBe("BlockFinalizationError");
    expect(error.blockNumber).toBe(100);
  });

  it("should create HistoricBlockError with correct properties", () => {
    const error = new HistoricBlockError({
      message: "Historic block search failed",
      targetTime: Date.now(),
    });
    expect(error._tag).toBe("HistoricBlockError");
    expect(error.targetTime).toBeGreaterThan(0);
  });

  it("should create RuntimeUpgradeCheckError with correct properties", () => {
    const error = new RuntimeUpgradeCheckError({
      message: "Upgrade check failed",
      blockNumber: 500,
    });
    expect(error._tag).toBe("RuntimeUpgradeCheckError");
    expect(error.blockNumber).toBe(500);
  });
});

// ============================================================================
// createAndFinalizeBlockEffect Tests
// ============================================================================

describe("createAndFinalizeBlockEffect", () => {
  it("should create a block successfully without parent hash", async () => {
    const mockRpc = mock(() => Promise.resolve({ hash: "0xnewhash", proof_size: 50 }));
    const mockApi = { rpc: mockRpc } as any;

    const result = await Effect.runPromise(createAndFinalizeBlockEffect(mockApi));

    expect(result.hash).toBe("0xnewhash");
    expect(result.proofSize).toBe(50);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(mockRpc).toHaveBeenCalledWith("engine_createBlock", true, false);
  });

  it("should create a block with parent hash", async () => {
    const mockRpc = mock(() => Promise.resolve({ hash: "0xchildhash", proof_size: 75 }));
    const mockApi = { rpc: mockRpc } as any;

    const result = await Effect.runPromise(
      createAndFinalizeBlockEffect(mockApi, "0xparenthash", true)
    );

    expect(result.hash).toBe("0xchildhash");
    expect(mockRpc).toHaveBeenCalledWith("engine_createBlock", true, true, "0xparenthash");
  });

  it("should return BlockCreationError on failure", async () => {
    const mockRpc = mock(() => Promise.reject(new Error("RPC failed")));
    const mockApi = { rpc: mockRpc } as any;

    const result = await Effect.runPromiseExit(createAndFinalizeBlockEffect(mockApi));

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = result.cause;
      expect(error._tag).toBe("Fail");
    }
  });
});

// ============================================================================
// checkBlockFinalizedEffect Tests
// ============================================================================

describe("checkBlockFinalizedEffect", () => {
  it("should return finalized status for a finalized block", async () => {
    const mockApi = {
      rpc: {
        chain: {
          getBlockHash: mock(() => Promise.resolve("0xfinalhash")),
        },
      },
      _rpcCore: {
        provider: {
          send: mock(() => Promise.resolve(true)),
        },
      },
    } as any;

    const result = await Effect.runPromise(checkBlockFinalizedEffect(mockApi, 100));

    expect(result.number).toBe(100);
    expect(result.finalized).toBe(true);
  });

  it("should return not finalized for a non-finalized block", async () => {
    const mockApi = {
      rpc: {
        chain: {
          getBlockHash: mock(() => Promise.resolve("0xpending")),
        },
      },
      _rpcCore: {
        provider: {
          send: mock(() => Promise.resolve(false)),
        },
      },
    } as any;

    const result = await Effect.runPromise(checkBlockFinalizedEffect(mockApi, 200));

    expect(result.number).toBe(200);
    expect(result.finalized).toBe(false);
  });

  it("should return BlockFinalizationError on RPC failure", async () => {
    const mockApi = {
      rpc: {
        chain: {
          getBlockHash: mock(() => Promise.reject(new Error("RPC error"))),
        },
      },
    } as any;

    const result = await Effect.runPromiseExit(checkBlockFinalizedEffect(mockApi, 300));

    expect(result._tag).toBe("Failure");
  });
});

// ============================================================================
// getBlockExtrinsicEffect Tests
// ============================================================================

describe("getBlockExtrinsicEffect", () => {
  it("should find an extrinsic by section and method", async () => {
    const mockExtrinsics = [
      { method: { section: "timestamp", method: "set" } },
      { method: { section: "balances", method: "transfer" } },
    ];

    const mockApi = {
      at: mock(() =>
        Promise.resolve({
          query: {
            system: {
              events: mock(() =>
                Promise.resolve([
                  {
                    phase: {
                      isApplyExtrinsic: true,
                      asApplyExtrinsic: { eq: (n: number) => n === 1 },
                    },
                    event: { section: "system", method: "ExtrinsicSuccess" },
                  },
                ])
              ),
            },
          },
        })
      ),
      rpc: {
        chain: {
          getBlock: mock(() =>
            Promise.resolve({
              block: { extrinsics: mockExtrinsics },
            })
          ),
        },
      },
    } as any;

    const result = await Effect.runPromise(
      getBlockExtrinsicEffect(mockApi, "0xblockhash", "balances", "transfer")
    );

    expect(result.extrinsic).not.toBeNull();
    expect(result.extrinsic?.method.section).toBe("balances");
  });

  it("should return null extrinsic when not found", async () => {
    const mockApi = {
      at: mock(() =>
        Promise.resolve({
          query: {
            system: {
              events: mock(() => Promise.resolve([])),
            },
          },
        })
      ),
      rpc: {
        chain: {
          getBlock: mock(() =>
            Promise.resolve({
              block: {
                extrinsics: [{ method: { section: "timestamp", method: "set" } }],
              },
            })
          ),
        },
      },
    } as any;

    const result = await Effect.runPromise(
      getBlockExtrinsicEffect(mockApi, "0xblockhash", "nonexistent", "method")
    );

    expect(result.extrinsic).toBeNull();
  });
});

// ============================================================================
// fetchHistoricBlockNumEffect Tests
// ============================================================================

describe("fetchHistoricBlockNumEffect", () => {
  it("should return 1 for block number <= 1", async () => {
    const mockApi = {} as any;

    const result = await Effect.runPromise(fetchHistoricBlockNumEffect(mockApi, 1, Date.now()));

    expect(result).toBe(1);
  });

  it("should return 1 for block number 0", async () => {
    const mockApi = {} as any;

    const result = await Effect.runPromise(fetchHistoricBlockNumEffect(mockApi, 0, Date.now()));

    expect(result).toBe(1);
  });
});

// ============================================================================
// checkTimeSliceForUpgradesEffect Tests
// ============================================================================

describe("checkTimeSliceForUpgradesEffect", () => {
  it("should detect runtime upgrade when versions differ", async () => {
    const mockCurrentVersion = {
      eq: () => false,
      toNumber: () => 900,
    } as any;

    const mockApi = {
      rpc: {
        chain: {
          getBlockHash: mock(() => Promise.resolve("0xhash")),
        },
      },
      at: mock(() =>
        Promise.resolve({
          query: {
            system: {
              lastRuntimeUpgrade: mock(() =>
                Promise.resolve({
                  unwrap: () => ({
                    specVersion: {
                      eq: (other: any) => false,
                      toNumber: () => 1000,
                    },
                  }),
                })
              ),
            },
          },
        })
      ),
    } as any;

    const result = await Effect.runPromise(
      checkTimeSliceForUpgradesEffect(mockApi, [100, 101, 102], mockCurrentVersion)
    );

    expect(result.result).toBe(true);
  });

  it("should not detect upgrade when versions match", async () => {
    const mockCurrentVersion = {
      eq: () => true,
      toNumber: () => 1000,
    } as any;

    const mockApi = {
      rpc: {
        chain: {
          getBlockHash: mock(() => Promise.resolve("0xhash")),
        },
      },
      at: mock(() =>
        Promise.resolve({
          query: {
            system: {
              lastRuntimeUpgrade: mock(() =>
                Promise.resolve({
                  unwrap: () => ({
                    specVersion: {
                      eq: () => true,
                    },
                  }),
                })
              ),
            },
          },
        })
      ),
    } as any;

    const result = await Effect.runPromise(
      checkTimeSliceForUpgradesEffect(mockApi, [100], mockCurrentVersion)
    );

    expect(result.result).toBe(false);
  });

  it("should fail with empty block numbers array", async () => {
    const mockApi = {} as any;
    const mockVersion = { eq: () => true } as any;

    const result = await Effect.runPromiseExit(
      checkTimeSliceForUpgradesEffect(mockApi, [], mockVersion)
    );

    expect(result._tag).toBe("Failure");
  });
});

// ============================================================================
// Effect Composition Tests
// ============================================================================

describe("Effect composition", () => {
  it("should allow chaining block operations", async () => {
    const mockRpc = mock(() => Promise.resolve({ hash: "0xhash1", proof_size: 10 }));
    const mockApi = { rpc: mockRpc } as any;

    const program = Effect.gen(function* () {
      const block1 = yield* createAndFinalizeBlockEffect(mockApi);
      const block2 = yield* createAndFinalizeBlockEffect(mockApi);
      return { block1, block2 };
    });

    const result = await Effect.runPromise(program);

    expect(result.block1.hash).toBe("0xhash1");
    expect(result.block2.hash).toBe("0xhash1");
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it("should handle errors in Effect.gen", async () => {
    const mockRpc = mock(() => Promise.reject(new Error("Block creation failed")));
    const mockApi = { rpc: mockRpc } as any;

    const program = Effect.gen(function* () {
      yield* createAndFinalizeBlockEffect(mockApi);
      return "should not reach here";
    });

    const result = await Effect.runPromiseExit(program);
    expect(result._tag).toBe("Failure");
  });

  it("should allow catching and recovering from errors", async () => {
    const mockRpc = mock(() => Promise.reject(new Error("Block creation failed")));
    const mockApi = { rpc: mockRpc } as any;

    const program = Effect.catchAll(createAndFinalizeBlockEffect(mockApi), (error) =>
      Effect.succeed({
        duration: 0,
        hash: "fallback",
        proofSize: 0,
        errorTag: error._tag,
      })
    );

    const result = await Effect.runPromise(program);
    expect(result.hash).toBe("fallback");
    expect((result as { errorTag?: string }).errorTag).toBe("BlockCreationError");
  });
});
