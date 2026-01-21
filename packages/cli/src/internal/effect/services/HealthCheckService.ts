import { Context, Effect, Layer, Ref } from "effect";
import type * as http from "node:http";
import type { MoonwallContext } from "../../../lib/globalContext.js";

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Health check response for a single provider.
 */
export interface ProviderHealth {
  readonly name: string;
  readonly type: string;
  readonly connected: boolean;
}

/**
 * Health check response for a network node.
 */
export interface NodeHealth {
  readonly name: string;
  readonly port: string;
  readonly status: "running" | "stopped" | "unknown";
}

/**
 * Overall health check response for the network.
 */
export interface HealthCheckResponse {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly environment: string;
  readonly foundation: string;
  readonly uptime: number;
  readonly timestamp: string;
  readonly nodes: ReadonlyArray<NodeHealth>;
  readonly providers: ReadonlyArray<ProviderHealth>;
  readonly endpoints: ReadonlyArray<string>;
}

/**
 * Configuration for the health check server.
 */
export interface HealthCheckConfig {
  readonly port: number;
  readonly host: string;
}

/**
 * Health check server status.
 */
export type HealthCheckServerStatus =
  | { readonly _tag: "Stopped" }
  | { readonly _tag: "Starting" }
  | { readonly _tag: "Running"; readonly port: number; readonly host: string }
  | { readonly _tag: "Failed"; readonly error: string };

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error when health check operations fail.
 */
export class HealthCheckError extends Error {
  readonly _tag = "HealthCheckError";
  constructor(message: string) {
    super(message);
    this.name = "HealthCheckError";
  }
}

/**
 * Error when the health check server fails to start or stop.
 */
export class HealthCheckServerError extends Error {
  readonly _tag = "HealthCheckServerError";
  constructor(message: string) {
    super(message);
    this.name = "HealthCheckServerError";
  }
}

// ============================================================================
// Health Check Service Interface
// ============================================================================

/**
 * Service interface for the health check HTTP server.
 */
export interface HealthCheckService {
  /**
   * Start the health check server on the specified port.
   * Returns an Effect that yields the stop function.
   */
  readonly start: (
    config: HealthCheckConfig
  ) => Effect.Effect<
    { readonly stop: () => Effect.Effect<void, HealthCheckServerError> },
    HealthCheckServerError
  >;

  /**
   * Stop the health check server.
   */
  readonly stop: () => Effect.Effect<void, HealthCheckServerError>;

  /**
   * Get the current status of the health check server.
   */
  readonly getStatus: () => Effect.Effect<HealthCheckServerStatus>;

  /**
   * Get the current health check response (without HTTP server).
   * Useful for programmatic health checks.
   */
  readonly getHealth: () => Effect.Effect<HealthCheckResponse, HealthCheckError>;
}

/**
 * Context tag for the HealthCheckService.
 */
export const HealthCheckService = Context.GenericTag<HealthCheckService>("HealthCheckService");

// ============================================================================
// Health Check Service Implementation
// ============================================================================

/**
 * Create a HealthCheckService that monitors a MoonwallContext.
 *
 * @param contextGetter - Function to get the current MoonwallContext
 * @returns Layer providing the HealthCheckService
 */
export const makeHealthCheckServiceLayer = (
  contextGetter: () => Promise<MoonwallContext | undefined>
): Layer.Layer<HealthCheckService> =>
  Layer.effect(
    HealthCheckService,
    Effect.gen(function* () {
      const serverRef = yield* Ref.make<http.Server | null>(null);
      const statusRef = yield* Ref.make<HealthCheckServerStatus>({ _tag: "Stopped" });
      const startTimeRef = yield* Ref.make<number>(Date.now());

      const getHealth = (): Effect.Effect<HealthCheckResponse, HealthCheckError> =>
        Effect.tryPromise({
          try: async () => {
            const ctx = await contextGetter();
            const startTime = await Effect.runPromise(Ref.get(startTimeRef));

            if (!ctx) {
              return {
                status: "unhealthy" as const,
                environment: process.env.MOON_TEST_ENV ?? "unknown",
                foundation: "unknown",
                uptime: Math.floor((Date.now() - startTime) / 1000),
                timestamp: new Date().toISOString(),
                nodes: [] as NodeHealth[],
                providers: [] as ProviderHealth[],
                endpoints: [] as string[],
              } satisfies HealthCheckResponse;
            }

            // Get node health
            const nodes: NodeHealth[] = [];
            const endpoints: string[] = [];

            if (ctx.environment?.nodes) {
              for (const node of ctx.environment.nodes) {
                const args = node.args || [];
                const portArg = args.find(
                  (a: string) => a.includes("ws-port") || a.includes("rpc-port")
                );
                const port = portArg ? (portArg.split("=")[1] ?? "9944") : "9944";

                nodes.push({
                  name: node.name ?? "node",
                  port,
                  status: ctx.nodes.length > 0 ? "running" : "stopped",
                });
                endpoints.push(`ws://127.0.0.1:${port}`);
              }
            }

            // Get provider health
            const providers: ProviderHealth[] = ctx.providers.map((p) => ({
              name: p.name,
              type: p.type,
              connected: true, // If in providers array, it's connected
            }));

            // Determine overall health status
            const isHealthy =
              ctx.configured && (ctx.nodes.length > 0 || ctx.foundation === "read_only");
            const hasSomeProviders = providers.length > 0;

            let status: "healthy" | "degraded" | "unhealthy";
            if (isHealthy && hasSomeProviders) {
              status = "healthy";
            } else if (isHealthy || hasSomeProviders) {
              status = "degraded";
            } else {
              status = "unhealthy";
            }

            return {
              status,
              environment: process.env.MOON_TEST_ENV ?? "unknown",
              foundation: ctx.foundation,
              uptime: Math.floor((Date.now() - startTime) / 1000),
              timestamp: new Date().toISOString(),
              nodes,
              providers,
              endpoints,
            } satisfies HealthCheckResponse;
          },
          catch: (error) =>
            new HealthCheckError(
              `Failed to get health: ${error instanceof Error ? error.message : String(error)}`
            ),
        });

      const start = (
        config: HealthCheckConfig
      ): Effect.Effect<
        { readonly stop: () => Effect.Effect<void, HealthCheckServerError> },
        HealthCheckServerError
      > =>
        Effect.gen(function* () {
          yield* Ref.set(statusRef, { _tag: "Starting" });
          yield* Ref.set(startTimeRef, Date.now());

          // Dynamically import http inside the async effect
          const server = yield* Effect.tryPromise({
            try: async () => {
              const http = await import("node:http");
              return http.createServer(async (req, res) => {
                // Set CORS headers for browser access
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type");

                if (req.method === "OPTIONS") {
                  res.writeHead(204);
                  res.end();
                  return;
                }

                if (req.url === "/health" || req.url === "/") {
                  try {
                    const health = await Effect.runPromise(getHealth());
                    const statusCode =
                      health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
                    res.writeHead(statusCode, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(health, null, 2));
                  } catch (error) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(
                      JSON.stringify({
                        status: "unhealthy",
                        error: error instanceof Error ? error.message : "Unknown error",
                        timestamp: new Date().toISOString(),
                      })
                    );
                  }
                } else if (req.url === "/ready") {
                  // Readiness check - is the network ready to accept connections?
                  try {
                    const health = await Effect.runPromise(getHealth());
                    const isReady = health.status === "healthy" || health.status === "degraded";
                    res.writeHead(isReady ? 200 : 503, { "Content-Type": "application/json" });
                    res.end(
                      JSON.stringify({ ready: isReady, timestamp: new Date().toISOString() })
                    );
                  } catch {
                    res.writeHead(503, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ready: false, timestamp: new Date().toISOString() }));
                  }
                } else if (req.url === "/live") {
                  // Liveness check - is the health server itself alive?
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ alive: true, timestamp: new Date().toISOString() }));
                } else {
                  res.writeHead(404, { "Content-Type": "application/json" });
                  res.end(
                    JSON.stringify({
                      error: "Not found",
                      availableEndpoints: ["/health", "/ready", "/live"],
                    })
                  );
                }
              });
            },
            catch: (error) =>
              new HealthCheckServerError(
                `Failed to create health check server: ${error instanceof Error ? error.message : String(error)}`
              ),
          });

          yield* Effect.tryPromise({
            try: () =>
              new Promise<void>((resolve, reject) => {
                server.on("error", reject);
                server.listen(config.port, config.host, () => resolve());
              }),
            catch: (error) =>
              new HealthCheckServerError(
                `Failed to start health check server: ${error instanceof Error ? error.message : String(error)}`
              ),
          });

          yield* Ref.set(serverRef, server);
          yield* Ref.set(statusRef, { _tag: "Running", port: config.port, host: config.host });

          const stopFn = (): Effect.Effect<void, HealthCheckServerError> =>
            Effect.gen(function* () {
              const currentServer = yield* Ref.get(serverRef);
              if (currentServer) {
                yield* Effect.tryPromise({
                  try: () =>
                    new Promise<void>((resolve) => {
                      currentServer.close(() => resolve());
                    }),
                  catch: () => new HealthCheckServerError("Failed to stop health check server"),
                });
                yield* Ref.set(serverRef, null);
                yield* Ref.set(statusRef, { _tag: "Stopped" });
              }
            });

          return { stop: stopFn };
        });

      const stop = (): Effect.Effect<void, HealthCheckServerError> =>
        Effect.gen(function* () {
          const currentServer = yield* Ref.get(serverRef);
          if (currentServer) {
            yield* Effect.tryPromise({
              try: () =>
                new Promise<void>((resolve) => {
                  currentServer.close(() => resolve());
                }),
              catch: () => new HealthCheckServerError("Failed to stop health check server"),
            });
            yield* Ref.set(serverRef, null);
            yield* Ref.set(statusRef, { _tag: "Stopped" });
          }
        });

      const getStatus = (): Effect.Effect<HealthCheckServerStatus> => Ref.get(statusRef);

      return {
        start,
        stop,
        getStatus,
        getHealth,
      };
    })
  );

/**
 * Default health check configuration.
 */
export const defaultHealthCheckConfig: HealthCheckConfig = {
  port: 9999,
  host: "127.0.0.1",
};
