import { describe, test, expect, beforeEach } from "bun:test";
import { Effect, Layer } from "effect";
import {
  HealthCheckService,
  makeHealthCheckServiceLayer,
  defaultHealthCheckConfig,
  type HealthCheckResponse,
} from "../../services/HealthCheckService.js";

// Mock MoonwallContext for testing
interface MockContext {
  configured: boolean;
  foundation: string;
  nodes: Array<{ pid?: number }>;
  providers: Array<{ name: string; type: string }>;
  environment?: {
    nodes?: Array<{ name?: string; args: string[] }>;
  };
}

describe("HealthCheckService", () => {
  let mockContext: MockContext | undefined;
  let testLayer: Layer.Layer<HealthCheckService>;

  beforeEach(() => {
    mockContext = undefined;
    testLayer = makeHealthCheckServiceLayer(async () => mockContext as any);
  });

  describe("getHealth", () => {
    test("returns unhealthy status when no context available", async () => {
      mockContext = undefined;

      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );

      expect(health.status).toBe("unhealthy");
      expect(health.foundation).toBe("unknown");
      expect(health.nodes).toHaveLength(0);
      expect(health.providers).toHaveLength(0);
      expect(health.endpoints).toHaveLength(0);
    });

    test("returns healthy status when context is configured with nodes and providers", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [
          { name: "polkadotJs", type: "polkadotJs" },
          { name: "ethers", type: "ethers" },
        ],
        environment: {
          nodes: [{ name: "dev-node", args: ["--ws-port=9944"] }],
        },
      };

      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );

      expect(health.status).toBe("healthy");
      expect(health.foundation).toBe("dev");
      expect(health.nodes).toHaveLength(1);
      expect(health.nodes[0].name).toBe("dev-node");
      expect(health.nodes[0].port).toBe("9944");
      expect(health.nodes[0].status).toBe("running");
      expect(health.providers).toHaveLength(2);
      expect(health.providers[0].name).toBe("polkadotJs");
      expect(health.providers[0].connected).toBe(true);
      expect(health.endpoints).toHaveLength(1);
      expect(health.endpoints[0]).toBe("ws://127.0.0.1:9944");
    });

    test("returns degraded status when configured but no providers", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [],
        environment: {
          nodes: [{ name: "dev-node", args: [] }],
        },
      };

      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );

      expect(health.status).toBe("degraded");
    });

    test("returns degraded status when providers exist but no nodes running", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [],
        providers: [{ name: "polkadotJs", type: "polkadotJs" }],
        environment: {
          nodes: [],
        },
      };

      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );

      expect(health.status).toBe("degraded");
    });

    test("returns healthy status for read_only foundation without nodes", async () => {
      mockContext = {
        configured: true,
        foundation: "read_only",
        nodes: [],
        providers: [{ name: "polkadotJs", type: "polkadotJs" }],
        environment: {
          nodes: [],
        },
      };

      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );

      expect(health.status).toBe("healthy");
      expect(health.foundation).toBe("read_only");
    });

    test("extracts port from --rpc-port argument", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [{ name: "polkadotJs", type: "polkadotJs" }],
        environment: {
          nodes: [{ name: "dev-node", args: ["--rpc-port=9933", "--other-arg"] }],
        },
      };

      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );

      expect(health.nodes[0].port).toBe("9933");
      expect(health.endpoints[0]).toBe("ws://127.0.0.1:9933");
    });

    test("uses default port 9944 when no port argument found", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [{ name: "polkadotJs", type: "polkadotJs" }],
        environment: {
          nodes: [{ name: "dev-node", args: ["--some-other-arg"] }],
        },
      };

      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );

      expect(health.nodes[0].port).toBe("9944");
    });

    test("handles node without name", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [{ name: "polkadotJs", type: "polkadotJs" }],
        environment: {
          nodes: [{ args: ["--ws-port=9944"] }], // No name property
        },
      };

      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );

      expect(health.nodes[0].name).toBe("node"); // Default name
    });

    test("includes timestamp in response", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [],
        environment: {
          nodes: [],
        },
      };

      const before = new Date().toISOString();
      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );
      const after = new Date().toISOString();

      expect(health.timestamp).toBeDefined();
      expect(health.timestamp >= before).toBe(true);
      expect(health.timestamp <= after).toBe(true);
    });

    test("includes uptime in response", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [],
        environment: {
          nodes: [],
        },
      };

      const health = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getHealth();
        }).pipe(Effect.provide(testLayer))
      );

      expect(typeof health.uptime).toBe("number");
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getStatus", () => {
    test("returns Stopped status initially", async () => {
      const status = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getStatus();
        }).pipe(Effect.provide(testLayer))
      );

      expect(status._tag).toBe("Stopped");
    });
  });

  describe("start and stop", () => {
    const testPort = 19999; // Use a high port unlikely to be in use

    test("starts and stops server successfully", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [{ name: "polkadotJs", type: "polkadotJs" }],
        environment: {
          nodes: [{ name: "dev-node", args: ["--ws-port=9944"] }],
        },
      };

      const { stop, status } = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;

          // Start the server
          const { stop } = yield* service.start({ port: testPort, host: "127.0.0.1" });

          // Check status is Running
          const status = yield* service.getStatus();

          return { stop, status };
        }).pipe(Effect.provide(testLayer))
      );

      expect(status._tag).toBe("Running");
      if (status._tag === "Running") {
        expect(status.port).toBe(testPort);
        expect(status.host).toBe("127.0.0.1");
      }

      // Stop the server
      await Effect.runPromise(stop().pipe(Effect.catchAll(() => Effect.void)));

      // Check status is Stopped
      const finalStatus = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          return yield* service.getStatus();
        }).pipe(Effect.provide(testLayer))
      );

      expect(finalStatus._tag).toBe("Stopped");
    });

    test("serves health endpoint via HTTP", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [{ name: "polkadotJs", type: "polkadotJs" }],
        environment: {
          nodes: [{ name: "dev-node", args: ["--ws-port=9944"] }],
        },
      };

      const stop = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          const { stop } = yield* service.start({ port: testPort, host: "127.0.0.1" });
          return stop;
        }).pipe(Effect.provide(testLayer))
      );

      try {
        // Make HTTP request to health endpoint
        const response = await fetch(`http://127.0.0.1:${testPort}/health`);
        const health = (await response.json()) as HealthCheckResponse;

        expect(response.status).toBe(200);
        expect(health.status).toBe("healthy");
        expect(health.foundation).toBe("dev");
        expect(health.nodes).toHaveLength(1);
      } finally {
        await Effect.runPromise(stop().pipe(Effect.catchAll(() => Effect.void)));
      }
    });

    test("serves /ready endpoint", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [{ name: "polkadotJs", type: "polkadotJs" }],
        environment: {
          nodes: [{ name: "dev-node", args: ["--ws-port=9944"] }],
        },
      };

      const stop = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          const { stop } = yield* service.start({ port: testPort, host: "127.0.0.1" });
          return stop;
        }).pipe(Effect.provide(testLayer))
      );

      try {
        const response = await fetch(`http://127.0.0.1:${testPort}/ready`);
        const data = (await response.json()) as { ready: boolean; timestamp: string };

        expect(response.status).toBe(200);
        expect(data.ready).toBe(true);
        expect(data.timestamp).toBeDefined();
      } finally {
        await Effect.runPromise(stop().pipe(Effect.catchAll(() => Effect.void)));
      }
    });

    test("serves /live endpoint", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [],
        environment: {
          nodes: [],
        },
      };

      const stop = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          const { stop } = yield* service.start({ port: testPort, host: "127.0.0.1" });
          return stop;
        }).pipe(Effect.provide(testLayer))
      );

      try {
        const response = await fetch(`http://127.0.0.1:${testPort}/live`);
        const data = (await response.json()) as { alive: boolean; timestamp: string };

        expect(response.status).toBe(200);
        expect(data.alive).toBe(true);
        expect(data.timestamp).toBeDefined();
      } finally {
        await Effect.runPromise(stop().pipe(Effect.catchAll(() => Effect.void)));
      }
    });

    test("returns 404 for unknown endpoints", async () => {
      mockContext = {
        configured: true,
        foundation: "dev",
        nodes: [{ pid: 12345 }],
        providers: [],
        environment: {
          nodes: [],
        },
      };

      const stop = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          const { stop } = yield* service.start({ port: testPort, host: "127.0.0.1" });
          return stop;
        }).pipe(Effect.provide(testLayer))
      );

      try {
        const response = await fetch(`http://127.0.0.1:${testPort}/unknown`);
        const data = (await response.json()) as { error: string; availableEndpoints: string[] };

        expect(response.status).toBe(404);
        expect(data.error).toBe("Not found");
        expect(data.availableEndpoints).toContain("/health");
        expect(data.availableEndpoints).toContain("/ready");
        expect(data.availableEndpoints).toContain("/live");
      } finally {
        await Effect.runPromise(stop().pipe(Effect.catchAll(() => Effect.void)));
      }
    });

    test("returns 503 for unhealthy status", async () => {
      mockContext = undefined; // No context means unhealthy

      const stop = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* HealthCheckService;
          const { stop } = yield* service.start({ port: testPort, host: "127.0.0.1" });
          return stop;
        }).pipe(Effect.provide(testLayer))
      );

      try {
        const response = await fetch(`http://127.0.0.1:${testPort}/health`);
        const health = (await response.json()) as HealthCheckResponse;

        expect(response.status).toBe(503);
        expect(health.status).toBe("unhealthy");
      } finally {
        await Effect.runPromise(stop().pipe(Effect.catchAll(() => Effect.void)));
      }
    });
  });

  describe("defaultHealthCheckConfig", () => {
    test("has sensible defaults", () => {
      expect(defaultHealthCheckConfig.port).toBe(9999);
      expect(defaultHealthCheckConfig.host).toBe("127.0.0.1");
    });
  });
});
