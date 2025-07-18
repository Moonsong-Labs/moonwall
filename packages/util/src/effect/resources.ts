import { Effect, Duration, Scope, Schedule } from "effect";
import { NetworkError, ResourceError, ProcessError, DockerError } from "@moonwall/types";
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import process from "node:process";

/**
 * Configuration for connection resources
 */
export interface ConnectionConfig {
  readonly endpoint: string;
  readonly timeout?: Duration.Duration;
  readonly retries?: number;
}

/**
 * Configuration for Docker container resources
 */
export interface ContainerConfig {
  readonly name: string;
  readonly image: string;
  readonly ports?: Record<string, string>;
  readonly environment?: Record<string, string>;
  readonly volumes?: Record<string, string>;
  readonly command?: string[];
}

/**
 * Configuration for process resources
 */
export interface ProcessConfig {
  readonly command: string;
  readonly args?: string[];
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly timeout?: Duration.Duration;
}

/**
 * Generic connection interface
 */
export interface Connection {
  readonly endpoint: string;
  readonly isConnected: boolean;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;
}

/**
 * Docker container interface
 */
export interface DockerContainer {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  remove(options?: { force?: boolean }): Promise<void>;
  logs(): Promise<string>;
}

/**
 * File handle interface
 */
export interface FileHandle {
  readonly path: string;
  readonly fd: number;
  read(
    buffer: Buffer,
    offset?: number,
    length?: number,
    position?: number
  ): Promise<{ bytesRead: number; buffer: Buffer }>;
  write(
    buffer: Buffer,
    offset?: number,
    length?: number,
    position?: number
  ): Promise<{ bytesWritten: number; buffer: Buffer }>;
  close(): Promise<void>;
}

/**
 * Creates a managed connection resource with automatic cleanup
 * This is a placeholder implementation - actual connection logic would depend on the specific protocol
 */
export const makeConnection = (config: ConnectionConfig) =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async (): Promise<Connection> => {
        // Placeholder implementation - would be replaced with actual connection logic
        const connection: Connection = {
          endpoint: config.endpoint,
          isConnected: true,
          disconnect: async () => {
            // Connection cleanup logic
          },
          ping: async () => true,
        };
        return connection;
      },
      catch: (error): NetworkError =>
        new NetworkError({
          message: `Failed to connect to ${config.endpoint}`,
          endpoint: config.endpoint,
          operation: "connect",
          cause: error,
        }),
    }),
    (connection) =>
      Effect.tryPromise({
        try: () => connection.disconnect(),
        catch: () =>
          new NetworkError({
            message: `Failed to disconnect from ${connection.endpoint}`,
            endpoint: connection.endpoint,
            operation: "disconnect",
          }),
      }).pipe(Effect.orElse(() => Effect.void))
  );

/**
 * Creates a managed Docker container resource with automatic cleanup
 * This is a placeholder implementation - actual Docker logic would use dockerode or similar
 */
export const makeDockerContainer = (config: ContainerConfig) =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async (): Promise<DockerContainer> => {
        // Placeholder implementation - would be replaced with actual Docker API calls
        const container: DockerContainer = {
          id: `container_${Date.now()}`,
          name: config.name,
          status: "created",
          start: async () => {
            // Start container logic
          },
          stop: async () => {
            // Stop container logic
          },
          remove: async (options) => {
            // Remove container logic
          },
          logs: async () => "Container logs",
        };
        return container;
      },
      catch: (error): DockerError =>
        new DockerError({
          message: `Failed to create container ${config.name}`,
          container: config.name,
          image: config.image,
          operation: "create",
          cause: error,
        }),
    }),
    (container) =>
      Effect.tryPromise({
        try: () => container.remove({ force: true }),
        catch: () =>
          new DockerError({
            message: `Failed to remove container ${container.name}`,
            container: container.name,
            operation: "remove",
          }),
      }).pipe(Effect.orElse(() => Effect.void))
  );

/**
 * Creates a managed file handle resource with automatic cleanup
 */
export const makeFileHandle = (path: string, flags: string = "r") =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async (): Promise<FileHandle> => {
        const fileHandle = await fs.open(path, flags);
        return {
          path,
          fd: fileHandle.fd,
          read: (buffer, offset, length, position) =>
            fileHandle.read(buffer, offset, length, position),
          write: (buffer, offset, length, position) =>
            fileHandle.write(buffer, offset, length, position),
          close: () => fileHandle.close(),
        };
      },
      catch: (error): ResourceError =>
        new ResourceError({
          message: `Failed to open file ${path}`,
          resource: path,
          operation: "acquire",
          cause: error,
        }),
    }),
    (fileHandle) =>
      Effect.tryPromise({
        try: () => fileHandle.close(),
        catch: () =>
          new ResourceError({
            message: `Failed to close file ${fileHandle.path}`,
            resource: fileHandle.path,
            operation: "release",
          }),
      }).pipe(Effect.orElse(() => Effect.void))
  );

/**
 * Creates a managed process resource with automatic cleanup
 */
export const makeProcess = (config: ProcessConfig) =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async (): Promise<ChildProcess> => {
        return new Promise((resolve, reject) => {
          const childProcess = spawn(config.command, config.args || [], {
            cwd: config.cwd,
            env: { ...process.env, ...config.env },
            stdio: ["pipe", "pipe", "pipe"],
          });

          childProcess.on("error", reject);
          childProcess.on("spawn", () => resolve(childProcess));

          // Handle timeout if specified
          if (config.timeout) {
            const timeoutMs = Duration.toMillis(config.timeout);
            setTimeout(() => {
              if (!childProcess.killed) {
                childProcess.kill("SIGTERM");
                reject(new Error(`Process ${config.command} timed out after ${timeoutMs}ms`));
              }
            }, timeoutMs);
          }
        });
      },
      catch: (error): ProcessError =>
        new ProcessError({
          message: `Failed to spawn process ${config.command}`,
          process: config.command,
          operation: "spawn",
          cause: error,
        }),
    }),
    (process) =>
      Effect.sync(() => {
        if (!process.killed) {
          process.kill("SIGTERM");
          // Give process time to terminate gracefully, then force kill
          setTimeout(() => {
            if (!process.killed) {
              process.kill("SIGKILL");
            }
          }, 5000);
        }
      })
  );

/**
 * Utility function to run multiple resources in parallel with proper cleanup
 */
export const withResources = <R, E, A>(
  resources: Effect.Effect<R, E, Scope.Scope>[],
  operation: (resources: R[]) => Effect.Effect<A, E, never>
): Effect.Effect<A, E, Scope.Scope> =>
  Effect.gen(function* (_) {
    const acquiredResources = yield* _(Effect.all(resources, { concurrency: "unbounded" }));
    return yield* _(operation(acquiredResources));
  });

/**
 * Utility function to retry resource acquisition with exponential backoff
 */
export const withRetry = <R, E, A>(
  resource: Effect.Effect<A, E, R>,
  maxRetries: number = 3,
  baseDelay: Duration.Duration = Duration.millis(100)
): Effect.Effect<A, E, R> =>
  Effect.retry(
    resource,
    Schedule.exponential(baseDelay).pipe(Schedule.intersect(Schedule.recurs(maxRetries)))
  );

/**
 * Utility function to add timeout to resource operations
 */
export const withTimeout = <R, E, A>(
  resource: Effect.Effect<A, E, R>,
  timeout: Duration.Duration
): Effect.Effect<
  A,
  E | { _tag: "TimeoutError"; message: string; operation: string; timeout: number },
  R
> =>
  Effect.timeout(resource, timeout).pipe(
    Effect.catchTag("TimeoutException", () =>
      Effect.fail({
        _tag: "TimeoutError" as const,
        message: `Operation timed out after ${Duration.toMillis(timeout)}ms`,
        operation: "resource_operation",
        timeout: Duration.toMillis(timeout),
      })
    )
  );

/**
 * Utility function to create a resource pool with connection limits
 */
export const createResourcePool = <R>(
  createResource: () => Effect.Effect<R, any, Scope.Scope>,
  maxSize: number = 10
) => {
  const pool: R[] = [];
  let activeCount = 0;

  const acquire = (): Effect.Effect<R, any, Scope.Scope> =>
    Effect.gen(function* (_) {
      if (pool.length > 0) {
        return pool.pop()!;
      }

      if (activeCount < maxSize) {
        activeCount++;
        return yield* _(createResource());
      }

      // Wait for a resource to become available
      return yield* _(Effect.sleep(Duration.millis(10)).pipe(Effect.flatMap(() => acquire())));
    });

  const release = (resource: R): Effect.Effect<void, never, never> =>
    Effect.sync(() => {
      pool.push(resource);
    });

  return { acquire, release };
};
