import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect, Exit } from "effect";
import { NodeReadinessService, NodeReadinessServiceLive } from "../NodeReadinessService.js";
import { NodeReadinessError } from "../errors.js";

// Create mock instance outside of vi.mock
const createMockWs = () => ({
  on: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  removeListener: vi.fn(),
});

let mockWsInstance = createMockWs();

vi.mock("ws", () => ({
  WebSocket: vi.fn(() => mockWsInstance),
}));

describe("NodeReadinessService", () => {
  beforeEach(() => {
    mockWsInstance = createMockWs();
    vi.clearAllMocks();
  });

  it("should successfully check readiness when system_chain responds", async () => {
    const mockConfig = { port: 9999, isEthereumChain: false, maxAttempts: 1 };

    // Simulate a successful 'system_chain' response
    mockWsInstance.on.mockImplementation((event: string, handler: any) => {
      if (event === "open") {
        setTimeout(() => handler(), 0);
      } else if (event === "message") {
        setTimeout(
          () => handler(Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "Moonbeam" }))),
          10
        );
      }
    });

    const program = NodeReadinessService.pipe(
      Effect.flatMap((service) => service.checkReady(mockConfig)),
      Effect.provide(NodeReadinessServiceLive)
    );

    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(true);
    }
    // Note: WebSocket mock interactions vary - main assertion is success
  });

  it("should fail if WebSocket connection errors", async () => {
    const mockConfig = { port: 1234, isEthereumChain: false, maxAttempts: 1 };

    mockWsInstance.on.mockImplementation((event: string, handler: any) => {
      if (event === "error") {
        setTimeout(() => handler(new Error("Connection refused")), 0);
      }
    });

    const program = NodeReadinessService.pipe(
      Effect.flatMap((service) => service.checkReady(mockConfig)),
      Effect.provide(NodeReadinessServiceLive)
    );

    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause._tag).toBe("Fail");
      if (exit.cause._tag === "Fail") {
        expect(exit.cause.error).toBeInstanceOf(NodeReadinessError);
        expect(exit.cause.error.port).toBe(mockConfig.port);
      }
    }
  });

  it("should check system_chain for non-Ethereum chains", async () => {
    const mockConfig = { port: 9999, isEthereumChain: false, maxAttempts: 1 };

    mockWsInstance.on.mockImplementation((event: string, handler: any) => {
      if (event === "open") {
        setTimeout(() => handler(), 0);
      } else if (event === "message") {
        setTimeout(
          () => handler(Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "Polkadot" }))),
          10
        );
      }
    });

    const program = NodeReadinessService.pipe(
      Effect.flatMap((service) => service.checkReady(mockConfig)),
      Effect.provide(NodeReadinessServiceLive)
    );

    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(mockWsInstance.send).toHaveBeenCalledWith(expect.stringContaining("system_chain"));
  });
});
