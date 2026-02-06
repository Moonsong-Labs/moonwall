import { describe, it, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { BuildBlockMode } from "@acala-network/chopsticks";
import {
  ChopsticksOrchestrationError,
  ChopsticksMultiChainService,
  type MultiChainConfig,
  type RelayChainConfig,
  type ParachainConfig,
  type MultiChainService,
  createPolkadotMoonbeamConfig,
  createKusamaMoonriverConfig,
  ChopsticksXcmError,
  ChopsticksBlockError,
} from "../index.js";

// =============================================================================
// Phase 4 Tests: Multi-chain XCM Support
// =============================================================================

describe("ChopsticksMultiChain - Phase 4: Multi-chain XCM Support", () => {
  describe("Module Exports", () => {
    it("should export ChopsticksOrchestrationError", async () => {
      const module = await import("../index.js");
      expect(module.ChopsticksOrchestrationError).toBeDefined();
    });

    it("should export ChopsticksMultiChainService tag", async () => {
      const module = await import("../index.js");
      expect(module.ChopsticksMultiChainService).toBeDefined();
      expect(module.ChopsticksMultiChainService.key).toBe("ChopsticksMultiChainService");
    });

    it("should export launchMultiChainEffect function", async () => {
      const module = await import("../index.js");
      expect(module.launchMultiChainEffect).toBeDefined();
      expect(typeof module.launchMultiChainEffect).toBe("function");
    });

    it("should export ChopsticksMultiChainLayer function", async () => {
      const module = await import("../index.js");
      expect(module.ChopsticksMultiChainLayer).toBeDefined();
      expect(typeof module.ChopsticksMultiChainLayer).toBe("function");
    });

    it("should export helper config functions", async () => {
      const module = await import("../index.js");
      expect(module.createPolkadotMoonbeamConfig).toBeDefined();
      expect(module.createKusamaMoonriverConfig).toBeDefined();
    });
  });

  describe("ChopsticksOrchestrationError", () => {
    it("should create error with correct tag and properties", () => {
      const error = new ChopsticksOrchestrationError({
        cause: new Error("Setup failed"),
        chains: ["relay", "para-2000"],
        operation: "setup",
      });

      expect(error._tag).toBe("ChopsticksOrchestrationError");
      expect(error.chains).toEqual(["relay", "para-2000"]);
      expect(error.operation).toBe("setup");
    });

    it.effect("should allow pattern matching with catchTag", () =>
      Effect.gen(function* () {
        yield* Effect.fail(
          new ChopsticksOrchestrationError({
            cause: new Error("XCM failed"),
            chains: ["relay"],
            operation: "xcm",
          })
        );
        return "success";
      }).pipe(
        Effect.catchTag("ChopsticksOrchestrationError", (error) =>
          Effect.succeed(`Caught: ${error.operation} on ${error.chains.join(", ")}`)
        ),
        Effect.map((result) => expect(result).toBe("Caught: xcm on relay"))
      )
    );
  });

  describe("Configuration Types", () => {
    it("should create valid RelayChainConfig with kebab-case keys", () => {
      const config: RelayChainConfig = {
        type: "relay",
        endpoint: "wss://rpc.polkadot.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      };

      expect(config.type).toBe("relay");
      expect(config.endpoint).toBe("wss://rpc.polkadot.io");
    });

    it("should create valid ParachainConfig with kebab-case keys", () => {
      const config: ParachainConfig = {
        type: "parachain",
        paraId: 2000,
        endpoint: "wss://moonbeam.rpc.io",
        port: 8001,
        "build-block-mode": BuildBlockMode.Manual,
      };

      expect(config.type).toBe("parachain");
      expect(config.paraId).toBe(2000);
    });

    it("should create valid MultiChainConfig with kebab-case keys", () => {
      const config: MultiChainConfig = {
        relay: {
          type: "relay",
          endpoint: "wss://rpc.polkadot.io",
          port: 8000,
          "build-block-mode": BuildBlockMode.Manual,
        },
        parachains: [
          {
            type: "parachain",
            paraId: 2000,
            endpoint: "wss://moonbeam.rpc.io",
            port: 8001,
            "build-block-mode": BuildBlockMode.Manual,
          },
          {
            type: "parachain",
            paraId: 2001,
            endpoint: "wss://acala.rpc.io",
            port: 8002,
            "build-block-mode": BuildBlockMode.Manual,
          },
        ],
      };

      expect(config.relay.type).toBe("relay");
      expect(config.parachains).toHaveLength(2);
      expect(config.parachains[0].paraId).toBe(2000);
      expect(config.parachains[1].paraId).toBe(2001);
    });
  });

  describe("Helper Config Functions", () => {
    it("should create Polkadot + Moonbeam config with defaults", () => {
      const config = createPolkadotMoonbeamConfig();

      expect(config.relay.type).toBe("relay");
      expect(config.relay.endpoint).toBe("wss://rpc.polkadot.io");
      expect(config.relay.port).toBe(8000);
      expect(config.parachains).toHaveLength(1);
      expect(config.parachains[0].paraId).toBe(2004);
      expect(config.parachains[0].port).toBe(8001);
    });

    it("should create Polkadot + Moonbeam config with custom ports", () => {
      const config = createPolkadotMoonbeamConfig(9000, 9001);

      expect(config.relay.port).toBe(9000);
      expect(config.parachains[0].port).toBe(9001);
    });

    it("should create Kusama + Moonriver config with defaults", () => {
      const config = createKusamaMoonriverConfig();

      expect(config.relay.type).toBe("relay");
      expect(config.relay.endpoint).toBe("wss://kusama-rpc.polkadot.io");
      expect(config.relay.port).toBe(8000);
      expect(config.parachains).toHaveLength(1);
      expect(config.parachains[0].paraId).toBe(2023);
      expect(config.parachains[0].port).toBe(8001);
    });

    it("should create Kusama + Moonriver config with custom ports", () => {
      const config = createKusamaMoonriverConfig(9000, 9001);

      expect(config.relay.port).toBe(9000);
      expect(config.parachains[0].port).toBe(9001);
    });
  });

  describe("MultiChainService Interface", () => {
    it("should define all required methods", () => {
      // Create a mock service to verify the interface
      const mockService: MultiChainService = {
        relay: {} as any,
        parachain: () => undefined,
        chains: new Map(),
        createBlocksAll: () => Effect.succeed(new Map()),
        sendUmp: () => Effect.void,
        sendDmp: () => Effect.void,
        sendHrmp: () => Effect.void,
        processXcm: () => Effect.void,
      };

      expect(mockService.relay).toBeDefined();
      expect(typeof mockService.parachain).toBe("function");
      expect(mockService.chains).toBeDefined();
      expect(typeof mockService.createBlocksAll).toBe("function");
      expect(typeof mockService.sendUmp).toBe("function");
      expect(typeof mockService.sendDmp).toBe("function");
      expect(typeof mockService.sendHrmp).toBe("function");
      expect(typeof mockService.processXcm).toBe("function");
    });

    it.effect("should have sendUmp return Effect with correct error type", () => {
      const mockService: MultiChainService = {
        relay: {} as any,
        parachain: () => undefined,
        chains: new Map(),
        createBlocksAll: () => Effect.succeed(new Map()),
        sendUmp: (paraId, _messages) =>
          Effect.fail(
            new ChopsticksXcmError({
              cause: new Error("UMP failed"),
              messageType: "ump",
              paraId,
            })
          ),
        sendDmp: () => Effect.void,
        sendHrmp: () => Effect.void,
        processXcm: () => Effect.void,
      };

      return mockService.sendUmp(2000, ["0x1234"]).pipe(
        Effect.catchTag("ChopsticksXcmError", (error) =>
          Effect.succeed({ caught: true, type: error.messageType })
        ),
        Effect.map((result) => {
          expect(result).toEqual({ caught: true, type: "ump" });
        })
      );
    });

    it.effect("should have sendDmp return Effect with correct error type", () => {
      const mockService: MultiChainService = {
        relay: {} as any,
        parachain: () => undefined,
        chains: new Map(),
        createBlocksAll: () => Effect.succeed(new Map()),
        sendUmp: () => Effect.void,
        sendDmp: (paraId, _messages) =>
          Effect.fail(
            new ChopsticksXcmError({
              cause: new Error("DMP failed"),
              messageType: "dmp",
              paraId,
            })
          ),
        sendHrmp: () => Effect.void,
        processXcm: () => Effect.void,
      };

      return mockService.sendDmp(2000, [{ sentAt: 1, msg: "0x1234" }]).pipe(
        Effect.catchTag("ChopsticksXcmError", (error) =>
          Effect.succeed({ caught: true, type: error.messageType })
        ),
        Effect.map((result) => {
          expect(result).toEqual({ caught: true, type: "dmp" });
        })
      );
    });

    it.effect("should have sendHrmp return Effect with correct error type", () => {
      const mockService: MultiChainService = {
        relay: {} as any,
        parachain: () => undefined,
        chains: new Map(),
        createBlocksAll: () => Effect.succeed(new Map()),
        sendUmp: () => Effect.void,
        sendDmp: () => Effect.void,
        sendHrmp: (fromParaId, toParaId, _messages) =>
          Effect.fail(
            new ChopsticksXcmError({
              cause: new Error("HRMP failed"),
              messageType: "hrmp",
              paraId: toParaId,
            })
          ),
        processXcm: () => Effect.void,
      };

      return mockService.sendHrmp(2000, 2001, [{ sentAt: 1, data: "0x1234" }]).pipe(
        Effect.catchTag("ChopsticksXcmError", (error) =>
          Effect.succeed({ caught: true, type: error.messageType })
        ),
        Effect.map((result) => {
          expect(result).toEqual({ caught: true, type: "hrmp" });
        })
      );
    });

    it.effect("should have createBlocksAll return Effect with correct error type", () => {
      const mockService: MultiChainService = {
        relay: {} as any,
        parachain: () => undefined,
        chains: new Map(),
        createBlocksAll: () =>
          Effect.fail(
            new ChopsticksBlockError({
              cause: new Error("Block creation failed"),
              operation: "newBlock",
            })
          ),
        sendUmp: () => Effect.void,
        sendDmp: () => Effect.void,
        sendHrmp: () => Effect.void,
        processXcm: () => Effect.void,
      };

      return mockService.createBlocksAll().pipe(
        Effect.catchTag("ChopsticksBlockError", (error) =>
          Effect.succeed({ caught: true, op: error.operation })
        ),
        Effect.map((result) => {
          expect(result).toEqual({ caught: true, op: "newBlock" });
        })
      );
    });
  });

  describe("ChopsticksMultiChainService Tag", () => {
    it("should have correct service key", () => {
      expect(ChopsticksMultiChainService.key).toBe("ChopsticksMultiChainService");
    });

    it.effect("should allow providing mock service via Layer", () => {
      const mockService: MultiChainService = {
        relay: { addr: "127.0.0.1:8000" } as any,
        parachain: () => undefined,
        chains: new Map(),
        createBlocksAll: () => Effect.succeed(new Map()),
        sendUmp: () => Effect.void,
        sendDmp: () => Effect.void,
        sendHrmp: () => Effect.void,
        processXcm: () => Effect.void,
      };

      const mockLayer = Layer.succeed(ChopsticksMultiChainService, mockService);

      return Effect.gen(function* () {
        const service = yield* ChopsticksMultiChainService;
        return service.relay.addr;
      }).pipe(
        Effect.provide(mockLayer),
        Effect.map((result) => expect(result).toBe("127.0.0.1:8000"))
      );
    });
  });

  describe("ChopsticksMultiChainLayer Type", () => {
    it("should create a Layer when called with config", async () => {
      const { ChopsticksMultiChainLayer } = await import("../index.js");

      const config: MultiChainConfig = {
        relay: {
          type: "relay",
          endpoint: "wss://test.io",
          port: 8000,
          "build-block-mode": BuildBlockMode.Manual,
        },
        parachains: [
          {
            type: "parachain",
            paraId: 2000,
            endpoint: "wss://para.test.io",
            port: 8001,
            "build-block-mode": BuildBlockMode.Manual,
          },
        ],
      };

      const layer = ChopsticksMultiChainLayer(config);
      expect(layer).toBeDefined();
    });

    it("should be providable to programs using ChopsticksMultiChainService", async () => {
      const { ChopsticksMultiChainLayer, ChopsticksMultiChainService } =
        await import("../index.js");

      const config: MultiChainConfig = {
        relay: {
          type: "relay",
          endpoint: "wss://test.io",
          port: 8000,
          "build-block-mode": BuildBlockMode.Manual,
        },
        parachains: [],
      };

      const layer = ChopsticksMultiChainLayer(config);

      const program = Effect.gen(function* () {
        const service = yield* ChopsticksMultiChainService;
        return service.relay;
      }).pipe(Effect.provide(layer));

      // Just verify the program is constructed correctly (compile-time check)
      expect(typeof program.pipe).toBe("function");
    });
  });

  describe("XCM Message Flow Types", () => {
    it("should support UMP message format (HexString[])", () => {
      const umpMessages: `0x${string}`[] = ["0x1234", "0x5678"];
      expect(umpMessages).toHaveLength(2);
    });

    it("should support DMP message format", () => {
      const dmpMessages: Array<{ sentAt: number; msg: `0x${string}` }> = [
        { sentAt: 100, msg: "0x1234" },
        { sentAt: 101, msg: "0x5678" },
      ];
      expect(dmpMessages).toHaveLength(2);
      expect(dmpMessages[0].sentAt).toBe(100);
    });

    it("should support HRMP message format", () => {
      const hrmpMessages: Array<{ sentAt: number; data: `0x${string}` }> = [
        { sentAt: 100, data: "0x1234" },
        { sentAt: 101, data: "0x5678" },
      ];
      expect(hrmpMessages).toHaveLength(2);
      expect(hrmpMessages[0].data).toBe("0x1234");
    });
  });
});

// =============================================================================
// Integration Tests (marked with skip - require actual network)
// =============================================================================

describe.skip("ChopsticksMultiChain - Integration Tests", () => {
  it("should launch multi-chain setup with relay and parachains", async () => {
    const { launchMultiChainEffect } = await import("../index.js");

    const { service, cleanup } = await launchMultiChainEffect({
      relay: {
        type: "relay",
        endpoint: "wss://rpc.polkadot.io",
        port: 8000,
        "build-block-mode": BuildBlockMode.Manual,
      },
      parachains: [
        {
          type: "parachain",
          paraId: 2004,
          endpoint: "wss://wss.api.moonbeam.network",
          port: 8001,
          "build-block-mode": BuildBlockMode.Manual,
        },
      ],
    });

    try {
      expect(service.relay).toBeDefined();
      expect(service.parachain(2004)).toBeDefined();
      expect(service.chains.size).toBe(2);
    } finally {
      await cleanup();
    }
  });

  it("should send UMP from parachain to relay", async () => {
    const { launchMultiChainEffect } = await import("../index.js");

    const { service, cleanup } = await launchMultiChainEffect(createPolkadotMoonbeamConfig());

    try {
      await Effect.runPromise(service.sendUmp(2004, ["0x1234"]));
      await Effect.runPromise(service.processXcm());
    } finally {
      await cleanup();
    }
  });
});
