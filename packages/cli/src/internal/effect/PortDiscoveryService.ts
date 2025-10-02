import { Effect, Context, Layer, Schedule } from "effect";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { PortDiscoveryError } from "./errors.js";

const execAsync = promisify(exec);

/**
 * Service for discovering ports used by a process
 */
export class PortDiscoveryService extends Context.Tag("PortDiscoveryService")<
  PortDiscoveryService,
  {
    /**
     * Discover ports used by a process ID with automatic retry
     * @param pid Process ID to inspect
     * @param maxAttempts Maximum number of retry attempts (default: 30)
     * @returns First discovered port number
     */
    readonly discoverPort: (
      pid: number,
      maxAttempts?: number
    ) => Effect.Effect<number, PortDiscoveryError>;
  }
>() {}

/**
 * Parse ports from lsof output
 * Example lsof line: "node 97796 user 26u IPv6 0xb6c3e894a2247189 0t0 TCP *:8000 (LISTEN)"
 */
const parsePortsFromLsof = (stdout: string): number[] => {
  const ports: number[] = [];
  const lines = stdout.split("\n");

  for (const line of lines) {
    const regex = /(?:.+):(\d+)/;
    const match = line.match(regex);
    if (match) {
      ports.push(Number.parseInt(match[1], 10));
    }
  }

  return ports;
};

/**
 * Attempt to discover ports for a given PID
 */
const attemptPortDiscovery = (pid: number): Effect.Effect<number, PortDiscoveryError> =>
  Effect.tryPromise({
    try: () => execAsync(`lsof -p ${pid} -n -P | grep LISTEN`),
    catch: (cause) =>
      new PortDiscoveryError({
        cause,
        pid,
        attempts: 1,
      }),
  }).pipe(
    Effect.flatMap(({ stdout }) => {
      const ports = parsePortsFromLsof(stdout);

      if (ports.length === 0) {
        return Effect.fail(
          new PortDiscoveryError({
            cause: new Error("No ports found in lsof output"),
            pid,
            attempts: 1,
          })
        );
      }

      // Find RPC port with fallback logic:
      // 1. Prefer ports in typical RPC range (9000-20000), excluding p2p port 30333 and metrics port 9615
      // 2. If only one port found, accept it (must be the RPC port)
      // 3. Otherwise fail with informative error
      const rpcPort = ports.find((p) => p >= 9000 && p <= 20000 && p !== 30333 && p !== 9615);

      if (!rpcPort) {
        // Fallback: if only one port, it must be the RPC port (e.g., Chopsticks ephemeral ports)
        if (ports.length === 1) {
          return Effect.succeed(ports[0]);
        }

        return Effect.fail(
          new PortDiscoveryError({
            cause: new Error(
              `No RPC port found in range 9000-20000 and multiple ports detected (found ports: ${ports.join(", ")})`
            ),
            pid,
            attempts: 1,
          })
        );
      }

      return Effect.succeed(rpcPort);
    })
  );

/**
 * Discover port with fixed interval retry
 */
const discoverPortWithRetry = (
  pid: number,
  maxAttempts = 600 // 600 attempts × 100ms = 60 seconds (handles parallel startup contention)
): Effect.Effect<number, PortDiscoveryError> =>
  attemptPortDiscovery(pid).pipe(
    Effect.retry(
      Schedule.fixed("100 millis").pipe(Schedule.compose(Schedule.recurs(maxAttempts - 1)))
    ),
    Effect.catchAll((error) =>
      Effect.fail(
        new PortDiscoveryError({
          cause: error,
          pid,
          attempts: maxAttempts,
        })
      )
    )
  );

/**
 * Live implementation of PortDiscoveryService
 */
export const PortDiscoveryServiceLive = Layer.succeed(PortDiscoveryService, {
  discoverPort: discoverPortWithRetry,
});
