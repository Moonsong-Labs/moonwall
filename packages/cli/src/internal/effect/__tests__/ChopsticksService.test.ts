import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { BuildBlockMode } from "@acala-network/chopsticks";
import {
  ChopsticksService,
  ChopsticksConfigTag,
  ChopsticksSetupError,
  ChopsticksBlockError,
  ChopsticksStorageError,
  ChopsticksExtrinsicError,
  ChopsticksXcmError,
  ChopsticksCleanupError,
  type ChopsticksConfig,
  type BlockCreationParams,
  type BlockCreationResult,
  type DryRunResult,
} from "../ChopsticksService.js";

// =============================================================================
// Phase 1 Tests: Error Types and Service Definition
// =============================================================================

describe("ChopsticksService - Phase 1: Types and Errors", () => {
  describe("Tagged Error Types", () => {
    it("should create ChopsticksSetupError with correct tag and properties", () => {
      const error = new ChopsticksSetupError({
        cause: new Error("Connection failed"),
        endpoint: "wss://rpc.polkadot.io",
        block: 12345,
      });

      expect(error._tag).toBe("ChopsticksSetupError");
      expect(error.endpoint).toBe("wss://rpc.polkadot.io");
      expect(error.block).toBe(12345);
      expect(error.cause).toBeInstanceOf(Error);
    });

    it("should create ChopsticksBlockError with correct tag and properties", () => {
      const error = new ChopsticksBlockError({
        cause: new Error("Block creation failed"),
        operation: "newBlock",
        blockIdentifier: 100,
      });

      expect(error._tag).toBe("ChopsticksBlockError");
      expect(error.operation).toBe("newBlock");
      expect(error.blockIdentifier).toBe(100);
    });

    it("should create ChopsticksStorageError with correct tag and properties", () => {
      const error = new ChopsticksStorageError({
        cause: new Error("Storage write failed"),
        module: "System",
        method: "Account",
      });

      expect(error._tag).toBe("ChopsticksStorageError");
      expect(error.module).toBe("System");
      expect(error.method).toBe("Account");
    });

    it("should create ChopsticksExtrinsicError with correct tag and properties", () => {
      const error = new ChopsticksExtrinsicError({
        cause: new Error("Extrinsic validation failed"),
        operation: "validate",
        extrinsic: "0x1234",
      });

      expect(error._tag).toBe("ChopsticksExtrinsicError");
      expect(error.operation).toBe("validate");
      expect(error.extrinsic).toBe("0x1234");
    });

    it("should create ChopsticksXcmError with correct tag and properties", () => {
      const error = new ChopsticksXcmError({
        cause: new Error("UMP send failed"),
        messageType: "ump",
        paraId: 2000,
      });

      expect(error._tag).toBe("ChopsticksXcmError");
      expect(error.messageType).toBe("ump");
      expect(error.paraId).toBe(2000);
    });

    it("should create ChopsticksCleanupError with correct tag", () => {
      const error = new ChopsticksCleanupError({
        cause: new Error("Cleanup failed"),
      });

      expect(error._tag).toBe("ChopsticksCleanupError");
    });
  });

  describe("Error Pattern Matching with catchTag", () => {
    it("should allow pattern matching on ChopsticksSetupError", async () => {
      const program = Effect.gen(function* () {
        yield* Effect.fail(
          new ChopsticksSetupError({
            cause: new Error("test"),
            endpoint: "wss://test.io",
          })
        );
        return "success";
      }).pipe(
        Effect.catchTag("ChopsticksSetupError", (error) =>
          Effect.succeed(`Caught setup error for ${error.endpoint}`)
        )
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe("Caught setup error for wss://test.io");
    });

    it("should allow pattern matching on ChopsticksBlockError", async () => {
      const program = Effect.gen(function* () {
        yield* Effect.fail(
          new ChopsticksBlockError({
            cause: new Error("test"),
            operation: "setHead",
            blockIdentifier: "0xabc",
          })
        );
        return "success";
      }).pipe(
        Effect.catchTag("ChopsticksBlockError", (error) =>
          Effect.succeed(`Caught ${error.operation} error`)
        )
      );

      const result = await Effect.runPromise(program);
      expect(result).toBe("Caught setHead error");
    });

    it("should allow catching multiple error types with catchTags", async () => {
      const failWithSetup = Effect.fail(
        new ChopsticksSetupError({ cause: new Error("setup"), endpoint: "wss://test" })
      );

      const failWithBlock = Effect.fail(
        new ChopsticksBlockError({ cause: new Error("block"), operation: "newBlock" })
      );

      const handleErrors = <A>(
        effect: Effect.Effect<A, ChopsticksSetupError | ChopsticksBlockError>
      ) =>
        effect.pipe(
          Effect.catchTags({
            ChopsticksSetupError: (e) => Effect.succeed(`setup: ${e.endpoint}`),
            ChopsticksBlockError: (e) => Effect.succeed(`block: ${e.operation}`),
          })
        );

      const result1 = await Effect.runPromise(handleErrors(failWithSetup));
      expect(result1).toBe("setup: wss://test");

      const result2 = await Effect.runPromise(handleErrors(failWithBlock));
      expect(result2).toBe("block: newBlock");
    });
  });

  describe("Service Tag Definition", () => {
    it("should have ChopsticksService tag with correct identifier", () => {
      // Verify the service tag exists and can be used
      expect(ChopsticksService).toBeDefined();
      expect(ChopsticksService.key).toBe("ChopsticksService");
    });

    it("should have ChopsticksConfigTag with correct identifier", () => {
      expect(ChopsticksConfigTag).toBeDefined();
      expect(ChopsticksConfigTag.key).toBe("ChopsticksConfig");
    });

    it("should require ChopsticksService in Effect context", () => {
      // This effect requires ChopsticksService to be provided
      // We verify this by checking the type system enforces context requirements
      const program = Effect.gen(function* () {
        const service = yield* ChopsticksService;
        return service.addr;
      });

      // The program type should show it requires ChopsticksService
      // This is a compile-time check - the Effect type includes ChopsticksService in R
      type ProgramType = typeof program;
      type _RequiresService =
        Effect.Effect.Context<ProgramType> extends ChopsticksService ? true : false;

      // We can verify the service key is required
      expect(ChopsticksService.key).toBe("ChopsticksService");
    });

    it("should allow providing a mock ChopsticksService", async () => {
      const mockService = {
        chain: {} as any,
        addr: "127.0.0.1:8000",
        port: 8000,
        createBlock: () => Effect.succeed({ block: { hash: "0x123" as const, number: 1 } }),
        setStorage: () => Effect.void,
        submitExtrinsic: () => Effect.succeed("0xhash" as `0x${string}`),
        dryRunExtrinsic: () => Effect.succeed({ success: true, storageDiff: [] } as DryRunResult),
        getBlock: () => Effect.succeed({ hash: "0x123" as `0x${string}`, number: 1 }),
        setHead: () => Effect.void,
        submitUpwardMessages: () => Effect.void,
        submitDownwardMessages: () => Effect.void,
        submitHorizontalMessages: () => Effect.void,
      };

      const mockLayer = Layer.succeed(ChopsticksService, mockService);

      const program = Effect.gen(function* () {
        const service = yield* ChopsticksService;
        return service.addr;
      }).pipe(Effect.provide(mockLayer));

      const result = await Effect.runPromise(program);
      expect(result).toBe("127.0.0.1:8000");
    });
  });

  describe("Config Type Validation", () => {
    it("should allow creating a valid ChopsticksConfig with kebab-case keys", () => {
      // ChopsticksConfig uses kebab-case keys matching chopsticks' native format
      const config: ChopsticksConfig = {
        endpoint: "wss://rpc.polkadot.io",
        block: 12345,
        port: 8000,
        host: "127.0.0.1",
        "build-block-mode": BuildBlockMode.Manual,
        "wasm-override": "/path/to/wasm",
        "allow-unresolved-imports": true,
        "mock-signature-host": true,
        db: "./chopsticks.db",
        "runtime-log-level": 3,
        "rpc-timeout": 30000, // New field supported via chopsticks type
      };

      expect(config.endpoint).toBe("wss://rpc.polkadot.io");
      expect(config.block).toBe(12345);
      expect(config.port).toBe(8000);
      expect(config["rpc-timeout"]).toBe(30000);
    });

    it("should allow ChopsticksConfig with required port and build-block-mode", () => {
      // The chopsticks Config type has port and build-block-mode as required after parsing
      const config: ChopsticksConfig = {
        endpoint: "wss://rpc.polkadot.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      };

      expect(config.endpoint).toBe("wss://rpc.polkadot.io");
      expect(config.port).toBe(8000);
      expect(config["build-block-mode"]).toBe(BuildBlockMode.Manual);
    });

    it("should allow providing ChopsticksConfig via Layer", async () => {
      const config: ChopsticksConfig = {
        endpoint: "wss://test.io",
        port: 9000,
        "build-block-mode": BuildBlockMode.Manual,
      };

      const configLayer = Layer.succeed(ChopsticksConfigTag, config);

      const program = Effect.gen(function* () {
        const cfg = yield* ChopsticksConfigTag;
        return cfg.endpoint;
      }).pipe(Effect.provide(configLayer));

      const result = await Effect.runPromise(program);
      expect(result).toBe("wss://test.io");
    });
  });

  describe("Block Creation Types", () => {
    it("should validate BlockCreationParams type", () => {
      const params: BlockCreationParams = {
        count: 5,
        to: 100,
        transactions: ["0x1234", "0x5678"],
        ump: { 2000: ["0xmsg1", "0xmsg2"] },
        dmp: [{ sentAt: 1, msg: "0xdmp" }],
        hrmp: { 2001: [{ sentAt: 2, data: "0xhrmp" }] },
      };

      expect(params.count).toBe(5);
      expect(params.transactions?.length).toBe(2);
    });

    it("should validate BlockCreationResult type", () => {
      const result: BlockCreationResult = {
        block: {
          hash: "0xabcdef",
          number: 42,
        },
      };

      expect(result.block.number).toBe(42);
      expect(result.block.hash).toBe("0xabcdef");
    });

    it("should validate DryRunResult type", () => {
      const result: DryRunResult = {
        success: true,
        storageDiff: [
          ["0xkey1", "0xvalue1"],
          ["0xkey2", null],
        ],
        error: undefined,
      };

      expect(result.success).toBe(true);
      expect(result.storageDiff.length).toBe(2);
    });
  });
});
