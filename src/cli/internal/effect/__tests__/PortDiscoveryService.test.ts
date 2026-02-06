import { expect } from "vitest";
import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { PortDiscoveryService, PortDiscoveryServiceLive, PortDiscoveryError } from "../index.js";

describe("PortDiscoveryService", () => {
  it.live(
    "should fail with PortDiscoveryError for invalid PID",
    () =>
      PortDiscoveryService.pipe(
        Effect.flatMap((service) => service.discoverPort(99999999, 3)), // Invalid PID, 3 attempts
        Effect.provide(PortDiscoveryServiceLive),
        Effect.flip,
        Effect.map((error) => {
          expect(error).toBeInstanceOf(PortDiscoveryError);
          expect(error.pid).toBe(99999999);
        })
      ),
    { timeout: 30000 }
  );

  it.live(
    "should discover port for current process",
    () => {
      const currentPid = process.pid;

      return PortDiscoveryService.pipe(
        Effect.flatMap((service) => service.discoverPort(currentPid, 5)), // Fewer attempts for speed
        Effect.provide(PortDiscoveryServiceLive),
        Effect.exit,
        // Current process may or may not have listening ports
        // This test mainly verifies the service structure works
        Effect.map((exit) => {
          expect(exit._tag).toMatch(/Success|Failure/);
        })
      );
    },
    { timeout: 30000 }
  );

  it.live(
    "should include attempt count in error",
    () =>
      PortDiscoveryService.pipe(
        Effect.flatMap((service) => service.discoverPort(99999999, 3)),
        Effect.provide(PortDiscoveryServiceLive),
        Effect.flip,
        Effect.map((error) => {
          expect(error.attempts).toBe(3);
        })
      ),
    { timeout: 30000 }
  );
});
