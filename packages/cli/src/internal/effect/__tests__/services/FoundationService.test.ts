import { describe, it, expect } from "bun:test";
import { Effect } from "effect";
import {
  FoundationServiceFactory,
  isDevFoundationConfig,
  isChopsticksFoundationConfig,
  isZombieFoundationConfig,
  isReadOnlyFoundationConfig,
  isDevFoundationStatus,
  isChopsticksFoundationStatus,
  isZombieFoundationStatus,
  isReadOnlyFoundationStatus,
  type AnyFoundationConfig,
  type AnyFoundationStatus,
} from "../../services/FoundationService.js";
import { DevFoundationServiceLive } from "../../services/DevFoundationServiceLive.js";
import { ChopsticksFoundationServiceLive } from "../../services/ChopsticksFoundationServiceLive.js";
import { ZombieFoundationServiceLive } from "../../services/ZombieFoundationServiceLive.js";
import { ReadOnlyFoundationServiceLive } from "../../services/ReadOnlyFoundationServiceLive.js";

describe("FoundationServiceFactory", () => {
  describe("getService", () => {
    it("returns DevFoundationServiceResult for 'dev' foundation type", async () => {
      const result = await Effect.runPromise(FoundationServiceFactory.getService("dev"));

      expect(result.foundationType).toBe("dev");
      expect(result.layer).toBe(DevFoundationServiceLive);
    });

    it("returns ChopsticksFoundationServiceResult for 'chopsticks' foundation type", async () => {
      const result = await Effect.runPromise(FoundationServiceFactory.getService("chopsticks"));

      expect(result.foundationType).toBe("chopsticks");
      expect(result.layer).toBe(ChopsticksFoundationServiceLive);
    });

    it("returns ZombieFoundationServiceResult for 'zombie' foundation type", async () => {
      const result = await Effect.runPromise(FoundationServiceFactory.getService("zombie"));

      expect(result.foundationType).toBe("zombie");
      expect(result.layer).toBe(ZombieFoundationServiceLive);
    });

    it("returns ReadOnlyFoundationServiceResult for 'read_only' foundation type", async () => {
      const result = await Effect.runPromise(FoundationServiceFactory.getService("read_only"));

      expect(result.foundationType).toBe("read_only");
      expect(result.layer).toBe(ReadOnlyFoundationServiceLive);
    });
  });

  describe("getLayer", () => {
    it("returns DevFoundationServiceLive for 'dev' foundation type", async () => {
      const layer = await Effect.runPromise(FoundationServiceFactory.getLayer("dev"));

      expect(layer).toBe(DevFoundationServiceLive);
    });

    it("returns ChopsticksFoundationServiceLive for 'chopsticks' foundation type", async () => {
      const layer = await Effect.runPromise(FoundationServiceFactory.getLayer("chopsticks"));

      expect(layer).toBe(ChopsticksFoundationServiceLive);
    });

    it("returns ZombieFoundationServiceLive for 'zombie' foundation type", async () => {
      const layer = await Effect.runPromise(FoundationServiceFactory.getLayer("zombie"));

      expect(layer).toBe(ZombieFoundationServiceLive);
    });

    it("returns ReadOnlyFoundationServiceLive for 'read_only' foundation type", async () => {
      const layer = await Effect.runPromise(FoundationServiceFactory.getLayer("read_only"));

      expect(layer).toBe(ReadOnlyFoundationServiceLive);
    });
  });

  describe("isSupported", () => {
    it("returns true for supported foundation types", () => {
      expect(FoundationServiceFactory.isSupported("dev")).toBe(true);
      expect(FoundationServiceFactory.isSupported("chopsticks")).toBe(true);
      expect(FoundationServiceFactory.isSupported("zombie")).toBe(true);
      expect(FoundationServiceFactory.isSupported("read_only")).toBe(true);
    });

    it("returns false for unsupported foundation types", () => {
      expect(FoundationServiceFactory.isSupported("invalid")).toBe(false);
      expect(FoundationServiceFactory.isSupported("")).toBe(false);
      expect(FoundationServiceFactory.isSupported("fork")).toBe(false);
    });
  });

  describe("getSupportedTypes", () => {
    it("returns all supported foundation types", () => {
      const types = FoundationServiceFactory.getSupportedTypes();

      expect(types).toContain("dev");
      expect(types).toContain("chopsticks");
      expect(types).toContain("zombie");
      expect(types).toContain("read_only");
      expect(types).toHaveLength(4);
    });

    it("returns a readonly array", () => {
      const types = FoundationServiceFactory.getSupportedTypes();

      // Verify it's an array that can be iterated
      expect(Array.isArray(types)).toBe(true);
    });
  });
});

describe("Type Guards - Config", () => {
  const devConfig: AnyFoundationConfig = {
    _type: "dev",
    command: "./node",
    args: ["--dev"],
    name: "test",
    launchSpec: {} as any,
    isEthereumChain: false,
  };

  const chopsticksConfig: AnyFoundationConfig = {
    _type: "chopsticks",
    configPath: "./config.yml",
    name: "test",
    launchSpec: {} as any,
  };

  const zombieConfig: AnyFoundationConfig = {
    _type: "zombie",
    configPath: "./zombienet.toml",
    name: "test",
    launchSpec: {} as any,
  };

  const readOnlyConfig: AnyFoundationConfig = {
    _type: "read_only",
    name: "test",
    launchSpec: {} as any,
    connections: [],
  };

  describe("isDevFoundationConfig", () => {
    it("returns true for dev config", () => {
      expect(isDevFoundationConfig(devConfig)).toBe(true);
    });

    it("returns false for non-dev configs", () => {
      expect(isDevFoundationConfig(chopsticksConfig)).toBe(false);
      expect(isDevFoundationConfig(zombieConfig)).toBe(false);
      expect(isDevFoundationConfig(readOnlyConfig)).toBe(false);
    });
  });

  describe("isChopsticksFoundationConfig", () => {
    it("returns true for chopsticks config", () => {
      expect(isChopsticksFoundationConfig(chopsticksConfig)).toBe(true);
    });

    it("returns false for non-chopsticks configs", () => {
      expect(isChopsticksFoundationConfig(devConfig)).toBe(false);
      expect(isChopsticksFoundationConfig(zombieConfig)).toBe(false);
      expect(isChopsticksFoundationConfig(readOnlyConfig)).toBe(false);
    });
  });

  describe("isZombieFoundationConfig", () => {
    it("returns true for zombie config", () => {
      expect(isZombieFoundationConfig(zombieConfig)).toBe(true);
    });

    it("returns false for non-zombie configs", () => {
      expect(isZombieFoundationConfig(devConfig)).toBe(false);
      expect(isZombieFoundationConfig(chopsticksConfig)).toBe(false);
      expect(isZombieFoundationConfig(readOnlyConfig)).toBe(false);
    });
  });

  describe("isReadOnlyFoundationConfig", () => {
    it("returns true for read_only config", () => {
      expect(isReadOnlyFoundationConfig(readOnlyConfig)).toBe(true);
    });

    it("returns false for non-read_only configs", () => {
      expect(isReadOnlyFoundationConfig(devConfig)).toBe(false);
      expect(isReadOnlyFoundationConfig(chopsticksConfig)).toBe(false);
      expect(isReadOnlyFoundationConfig(zombieConfig)).toBe(false);
    });
  });
});

describe("Type Guards - Status", () => {
  const devStatus: AnyFoundationStatus = {
    _type: "dev",
    _tag: "Running",
    rpcPort: 9944,
    pid: 1234,
  };

  const chopsticksStatus: AnyFoundationStatus = {
    _type: "chopsticks",
    _tag: "Running",
    wsPort: 8000,
    endpoint: "ws://127.0.0.1:8000",
  };

  const zombieStatus: AnyFoundationStatus = {
    _type: "zombie",
    _tag: "Running",
    relayWsEndpoint: "ws://127.0.0.1:9944",
    nodeCount: 3,
  };

  const readOnlyStatus: AnyFoundationStatus = {
    _type: "read_only",
    _tag: "Connected",
    connectedProviders: 2,
    endpoints: ["wss://rpc.polkadot.io"],
  };

  describe("isDevFoundationStatus", () => {
    it("returns true for dev status", () => {
      expect(isDevFoundationStatus(devStatus)).toBe(true);
    });

    it("returns false for non-dev statuses", () => {
      expect(isDevFoundationStatus(chopsticksStatus)).toBe(false);
      expect(isDevFoundationStatus(zombieStatus)).toBe(false);
      expect(isDevFoundationStatus(readOnlyStatus)).toBe(false);
    });
  });

  describe("isChopsticksFoundationStatus", () => {
    it("returns true for chopsticks status", () => {
      expect(isChopsticksFoundationStatus(chopsticksStatus)).toBe(true);
    });

    it("returns false for non-chopsticks statuses", () => {
      expect(isChopsticksFoundationStatus(devStatus)).toBe(false);
      expect(isChopsticksFoundationStatus(zombieStatus)).toBe(false);
      expect(isChopsticksFoundationStatus(readOnlyStatus)).toBe(false);
    });
  });

  describe("isZombieFoundationStatus", () => {
    it("returns true for zombie status", () => {
      expect(isZombieFoundationStatus(zombieStatus)).toBe(true);
    });

    it("returns false for non-zombie statuses", () => {
      expect(isZombieFoundationStatus(devStatus)).toBe(false);
      expect(isZombieFoundationStatus(chopsticksStatus)).toBe(false);
      expect(isZombieFoundationStatus(readOnlyStatus)).toBe(false);
    });
  });

  describe("isReadOnlyFoundationStatus", () => {
    it("returns true for read_only status", () => {
      expect(isReadOnlyFoundationStatus(readOnlyStatus)).toBe(true);
    });

    it("returns false for non-read_only statuses", () => {
      expect(isReadOnlyFoundationStatus(devStatus)).toBe(false);
      expect(isReadOnlyFoundationStatus(chopsticksStatus)).toBe(false);
      expect(isReadOnlyFoundationStatus(zombieStatus)).toBe(false);
    });
  });
});

describe("Type Guards - Status Tags", () => {
  it("handles Starting status correctly", () => {
    const status: AnyFoundationStatus = {
      _type: "dev",
      _tag: "Starting",
    };
    expect(isDevFoundationStatus(status)).toBe(true);
    expect(status._tag).toBe("Starting");
  });

  it("handles Stopped status correctly", () => {
    const status: AnyFoundationStatus = {
      _type: "chopsticks",
      _tag: "Stopped",
    };
    expect(isChopsticksFoundationStatus(status)).toBe(true);
    expect(status._tag).toBe("Stopped");
  });

  it("handles Failed status correctly", () => {
    const status: AnyFoundationStatus = {
      _type: "zombie",
      _tag: "Failed",
      error: new Error("test error"),
    };
    expect(isZombieFoundationStatus(status)).toBe(true);
    expect(status._tag).toBe("Failed");
  });

  it("handles Connecting status correctly for read_only", () => {
    const status: AnyFoundationStatus = {
      _type: "read_only",
      _tag: "Connecting",
    };
    expect(isReadOnlyFoundationStatus(status)).toBe(true);
    expect(status._tag).toBe("Connecting");
  });

  it("handles Disconnected status correctly for read_only", () => {
    const status: AnyFoundationStatus = {
      _type: "read_only",
      _tag: "Disconnected",
    };
    expect(isReadOnlyFoundationStatus(status)).toBe(true);
    expect(status._tag).toBe("Disconnected");
  });
});
