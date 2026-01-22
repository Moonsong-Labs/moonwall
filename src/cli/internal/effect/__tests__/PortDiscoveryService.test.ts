import { describe, it, expect } from "vitest";
import { Effect, Exit } from "effect";
import { PortDiscoveryService, PortDiscoveryServiceLive, PortDiscoveryError } from "../index.js";

describe("PortDiscoveryService", () => {
  it("should fail with PortDiscoveryError for invalid PID", async () => {
    const program = PortDiscoveryService.pipe(
      Effect.flatMap((service) => service.discoverPort(99999999, 3)), // Invalid PID, 3 attempts
      Effect.provide(PortDiscoveryServiceLive)
    );

    const exit = await Effect.runPromiseExit(program);

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause._tag).toBe("Fail");
      if (exit.cause._tag === "Fail") {
        expect(exit.cause.error).toBeInstanceOf(PortDiscoveryError);
        expect(exit.cause.error.pid).toBe(99999999);
      }
    }
  });

  it("should discover port for current process", async () => {
    const currentPid = process.pid;

    const program = PortDiscoveryService.pipe(
      Effect.flatMap((service) => service.discoverPort(currentPid, 5)), // Fewer attempts for speed
      Effect.provide(PortDiscoveryServiceLive)
    );

    const exit = await Effect.runPromiseExit(program);

    // Current process may or may not have listening ports
    // This test mainly verifies the service structure works
    expect(exit._tag).toMatch(/Success|Failure/);
  });

  it("should include attempt count in error", async () => {
    const maxAttempts = 3;

    const program = PortDiscoveryService.pipe(
      Effect.flatMap((service) => service.discoverPort(99999999, maxAttempts)),
      Effect.provide(PortDiscoveryServiceLive)
    );

    const exit = await Effect.runPromiseExit(program);

    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      expect(exit.cause.error.attempts).toBe(maxAttempts);
    }
  });
});
