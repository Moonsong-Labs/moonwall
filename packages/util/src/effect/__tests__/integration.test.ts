import { describe, it, expect, vi, beforeEach } from "vitest";
import * as viemFunctions from "../../functions/viem";
import * as providerFunctions from "../../functions/providers";
import { ALITH_ADDRESS } from "../../constants/accounts";

// Mock the Effect implementations
vi.mock("../viem.effect", () => ({
  checkBalanceEffect: vi.fn(),
  createRawTransferEffect: vi.fn(),
  sendRawTransactionEffect: vi.fn(),
  createViemTransactionEffect: vi.fn(),
  deriveViemChainEffect: vi.fn(),
  deployViemContractEffect: vi.fn(),
}));

vi.mock("../providers.effect", () => ({
  customWeb3RequestEffect: vi.fn(),
  web3EthCallEffect: vi.fn(),
}));

vi.mock("../interop", () => ({
  runPromiseEffect: vi.fn((effect) => {
    // Simple mock that extracts the result from the Effect
    if (effect._tag === "Succeed") {
      return Promise.resolve(effect.value);
    }
    if (effect._tag === "Fail") {
      return Promise.reject(effect.error);
    }
    // For actual Effect objects, we'll return a mock value
    return Promise.resolve(effect.mockResult || "mock-result");
  }),
}));

describe("Integration: Promise APIs with Effect implementations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("viem functions", () => {
    it("checkBalance should return Promise<bigint>", async () => {
      const mockContext = {
        viem: () => ({ transport: { url: "http://localhost:8545" } }),
      };
      const expectedBalance = 1000000000000000000n;

      // Mock the Effect implementation
      const { checkBalanceEffect } = await import("../viem.effect");
      (checkBalanceEffect as any).mockReturnValue({
        mockResult: expectedBalance,
      });

      const balance = await viemFunctions.checkBalance(mockContext as any);

      expect(typeof balance).toBe("bigint");
      expect(balance).toBe(expectedBalance);
      expect(checkBalanceEffect).toHaveBeenCalledWith(
        mockContext,
        ALITH_ADDRESS,
        "latest"
      );
    });

    it("createRawTransfer should return Promise<0x${string}>", async () => {
      const mockContext = {
        viem: () => ({ transport: { url: "http://localhost:8545" } }),
      };
      const to = "0x1234567890123456789012345678901234567890";
      const value = 1000n;
      const expectedTx = "0xsignedtransaction";

      const { createRawTransferEffect } = await import("../viem.effect");
      (createRawTransferEffect as any).mockReturnValue({
        mockResult: expectedTx,
      });

      const tx = await viemFunctions.createRawTransfer(
        mockContext as any,
        to as any,
        value
      );

      expect(typeof tx).toBe("string");
      expect(tx).toBe(expectedTx);
      expect(tx).toMatch(/^0x/);
    });

    it("sendRawTransaction should return Promise<0x${string}>", async () => {
      const mockContext = {
        viem: () => ({ transport: { url: "http://localhost:8545" } }),
      };
      const rawTx = "0xf86c01850100000000";
      const expectedHash = "0xtransactionhash";

      const { sendRawTransactionEffect } = await import("../viem.effect");
      (sendRawTransactionEffect as any).mockReturnValue({
        mockResult: expectedHash,
      });

      const hash = await viemFunctions.sendRawTransaction(
        mockContext as any,
        rawTx as any
      );

      expect(typeof hash).toBe("string");
      expect(hash).toBe(expectedHash);
      expect(hash).toMatch(/^0x/);
    });

    it("deriveViemChain should return Promise<Chain>", async () => {
      const endpoint = "http://localhost:8545";
      const expectedChain = {
        id: 1,
        name: "Moonbeam",
        nativeCurrency: {
          decimals: 18,
          name: "GLMR",
          symbol: "GLMR",
        },
        rpcUrls: {
          public: { http: [endpoint] },
          default: { http: [endpoint] },
        },
      };

      const { deriveViemChainEffect } = await import("../viem.effect");
      (deriveViemChainEffect as any).mockReturnValue({
        mockResult: expectedChain,
      });

      const chain = await viemFunctions.deriveViemChain(endpoint);

      expect(chain).toEqual(expectedChain);
      expect(chain.id).toBe(1);
      expect(chain.name).toBe("Moonbeam");
    });

    it("deployViemContract should return contract deployment result", async () => {
      const mockContext = {
        viem: () => ({ transport: { url: "http://localhost:8545" } }),
        createBlock: vi.fn(),
      };
      const abi = [];
      const bytecode = "0x608060405234801561001057600080fd5b50";
      const expectedResult = {
        contractAddress: "0xcontractaddress",
        status: "success",
        logs: [],
        hash: "0xdeploymenthash",
      };

      const { deployViemContractEffect } = await import("../viem.effect");
      (deployViemContractEffect as any).mockReturnValue({
        mockResult: expectedResult,
      });

      const result = await viemFunctions.deployViemContract(
        mockContext as any,
        abi,
        bytecode as any
      );

      expect(result).toEqual(expectedResult);
      expect(result.contractAddress).toBe("0xcontractaddress");
      expect(result.status).toBe("success");
    });
  });

  describe("provider functions", () => {
    it("customWeb3Request should return Promise<any>", async () => {
      const mockWeb3 = {
        eth: { currentProvider: {} },
      };
      const method = "eth_blockNumber";
      const params = [];
      const expectedResult = "0x123";

      const { customWeb3RequestEffect } = await import("../providers.effect");
      (customWeb3RequestEffect as any).mockReturnValue({
        mockResult: expectedResult,
      });

      const result = await providerFunctions.customWeb3Request(
        mockWeb3 as any,
        method,
        params
      );

      expect(result).toBe(expectedResult);
      expect(customWeb3RequestEffect).toHaveBeenCalledWith(
        mockWeb3,
        method,
        params
      );
    });

    it("web3EthCall should return Promise<any>", async () => {
      const mockWeb3 = {
        eth: { currentProvider: {} },
      };
      const options = {
        to: "0x1234567890123456789012345678901234567890",
        data: "0x123456",
      };
      const expectedResult = "0xresult";

      const { web3EthCallEffect } = await import("../providers.effect");
      (web3EthCallEffect as any).mockReturnValue({
        mockResult: expectedResult,
      });

      const result = await providerFunctions.web3EthCall(
        mockWeb3 as any,
        options
      );

      expect(result).toBe(expectedResult);
      expect(web3EthCallEffect).toHaveBeenCalledWith(mockWeb3, options);
    });
  });

  describe("Error propagation", () => {
    it("should propagate Effect errors as Promise rejections", async () => {
      const mockContext = {
        viem: () => ({ transport: { url: "http://localhost:8545" } }),
      };
      const error = new Error("Network error");

      // Mock runPromiseEffect to reject
      const { runPromiseEffect } = await import("../interop");
      (runPromiseEffect as any).mockRejectedValue(error);

      await expect(
        viemFunctions.checkBalance(mockContext as any)
      ).rejects.toThrow("Network error");
    });

    it("should preserve error types through Promise rejection", async () => {
      const { NetworkError } = await import("@moonwall/types");
      const mockContext = {
        viem: () => ({ transport: { url: "http://localhost:8545" } }),
      };
      const networkError = new (NetworkError as any)({
        message: "Connection failed",
        endpoint: "http://localhost:8545",
        operation: "checkBalance",
      });

      const { runPromiseEffect } = await import("../interop");
      (runPromiseEffect as any).mockRejectedValue(networkError);

      try {
        await viemFunctions.checkBalance(mockContext as any);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("Connection failed");
      }
    });
  });

  describe("Backward compatibility", () => {
    it("should maintain the same function signatures", () => {
      // Verify function signatures haven't changed
      expect(typeof viemFunctions.checkBalance).toBe("function");
      expect(typeof viemFunctions.createRawTransfer).toBe("function");
      expect(typeof viemFunctions.sendRawTransaction).toBe("function");
      expect(typeof viemFunctions.createViemTransaction).toBe("function");
      expect(typeof viemFunctions.deriveViemChain).toBe("function");
      expect(typeof viemFunctions.deployViemContract).toBe("function");
      
      expect(typeof providerFunctions.customWeb3Request).toBe("function");
      expect(typeof providerFunctions.web3EthCall).toBe("function");
    });

    it("should work with async/await syntax", async () => {
      const mockContext = {
        viem: () => ({ transport: { url: "http://localhost:8545" } }),
      };

      // Re-mock runPromiseEffect for this test
      const { runPromiseEffect } = await import("../interop");
      (runPromiseEffect as any).mockImplementation(() => Promise.resolve(1000n));

      // Traditional async/await should work
      const balance = await viemFunctions.checkBalance(mockContext as any);
      expect(balance).toBe(1000n);

      // Promise chaining should work
      const balancePromise = viemFunctions
        .checkBalance(mockContext as any)
        .then((b) => b + 500n);
      
      await expect(balancePromise).resolves.toBe(1500n);
    });

    it("should work with Promise.all for batch operations", async () => {
      const mockContext = {
        viem: () => ({ transport: { url: "http://localhost:8545" } }),
      };
      const addresses = [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333",
      ];

      // Re-mock runPromiseEffect for this test
      const { runPromiseEffect } = await import("../interop");
      let callIndex = 0;
      (runPromiseEffect as any).mockImplementation(() => {
        // Return different values based on call order
        const values = [
          BigInt("0x1111"),
          BigInt("0x2222"),
          BigInt("0x3333")
        ];
        return Promise.resolve(values[callIndex++ % values.length]);
      });

      const balances = await Promise.all(
        addresses.map((addr) =>
          viemFunctions.checkBalance(mockContext as any, addr as any)
        )
      );

      expect(balances).toHaveLength(3);
      expect(balances[0]).toBe(BigInt("0x1111"));
      expect(balances[1]).toBe(BigInt("0x2222"));
      expect(balances[2]).toBe(BigInt("0x3333"));
    });
  });

  describe("Performance considerations", () => {
    it("should not introduce significant overhead", async () => {
      const mockContext = {
        viem: () => ({ transport: { url: "http://localhost:8545" } }),
      };

      // Re-mock runPromiseEffect for this test
      const { runPromiseEffect } = await import("../interop");
      (runPromiseEffect as any).mockImplementation(() => Promise.resolve(1000n));

      const startTime = performance.now();
      
      // Run multiple operations
      const promises = Array.from({ length: 100 }, () =>
        viemFunctions.checkBalance(mockContext as any)
      );
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 100 operations in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});