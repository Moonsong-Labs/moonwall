import { Context, Effect, Layer, Queue, Deferred, pipe } from "effect";
import { FileSystem, Path } from "@effect/platform";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import { NodeLaunchError, ProcessError } from "./errors.js";
import { createLogger } from "@moonwall/util";

const logger = createLogger({ name: "ProcessManagerService" });

/**
 * Extended ChildProcess with Moonwall metadata
 */
export interface MoonwallProcess extends ChildProcess {
  isMoonwallTerminating?: boolean;
  moonwallTerminationReason?: string;
  effectCleanup?: () => Promise<void>;
}

/**
 * Configuration for launching a process
 */
export interface ProcessConfig {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly name: string;
  readonly logDirectory?: string;
}

/**
 * Result of launching a process
 */
export interface ProcessLaunchResult {
  readonly process: MoonwallProcess;
  readonly logPath: string;
}

/**
 * Service for managing process lifecycle with manual cleanup
 */
export class ProcessManagerService extends Context.Tag("ProcessManagerService")<
  ProcessManagerService,
  {
    /**
     * Launch a process with manual cleanup function
     * @param config Process configuration
     * @returns Object containing the process launch result and a cleanup effect to be called manually
     */
    readonly launch: (
      config: ProcessConfig
    ) => Effect.Effect<
      { result: ProcessLaunchResult; cleanup: Effect.Effect<void, ProcessError> },
      NodeLaunchError | ProcessError
    >;
  }
>() {}

/**
 * Generate log file path for a process using Effect Path
 */
const getLogPath = (config: ProcessConfig, pid: number): Effect.Effect<string, ProcessError> =>
  pipe(
    Effect.all([Path.Path, Effect.sync(() => process.cwd())]),
    Effect.map(([pathService, cwd]) => {
      const dirPath = config.logDirectory || pathService.join(cwd, "tmp", "node_logs");
      const portArg = config.args.find((a) => a.includes("port"));
      const port = portArg?.split("=")[1] || "unknown";
      const baseName = pathService.basename(config.command);

      return pathService
        .join(dirPath, `${baseName}_node_${port}_${pid}.log`)
        .replace(/node_node_undefined/g, "chopsticks");
    }),
    Effect.provide(NodePath.layer),
    Effect.mapError(
      (cause) =>
        new ProcessError({
          cause,
          operation: "spawn",
        })
    )
  );

/**
 * Ensure log directory exists - using fs.promises for test compatibility
 */
const ensureLogDirectory = (dirPath: string): Effect.Effect<void, ProcessError> =>
  Effect.tryPromise({
    try: async () => {
      try {
        await fs.promises.access(dirPath);
      } catch {
        await fs.promises.mkdir(dirPath, { recursive: true });
      }
    },
    catch: (cause) =>
      new ProcessError({
        cause,
        operation: "spawn",
      }),
  });

/**
 * Spawn a child process - using node:child_process for test compatibility
 */
const spawnProcess = (config: ProcessConfig): Effect.Effect<MoonwallProcess, NodeLaunchError> =>
  Effect.try({
    try: () => {
      const child = spawn(config.command, [...config.args]) as MoonwallProcess;

      // Check for immediate spawn errors
      child.on("error", (error) => {
        logger.error(`Process spawn error: ${error}`);
      });

      return child;
    },
    catch: (cause) =>
      new NodeLaunchError({
        cause,
        command: config.command,
        args: [...config.args],
      }),
  });

/**
 * Create a log write queue for buffered, async-safe logging using Effect FileSystem
 */
const createLogQueue = (
  logPath: string
): Effect.Effect<
  {
    readonly write: (data: string) => Effect.Effect<void>;
    readonly close: () => Effect.Effect<void>;
  },
  ProcessError
> =>
  pipe(
    Queue.bounded<string>(100),
    Effect.flatMap((queue) =>
      pipe(
        FileSystem.FileSystem,
        Effect.flatMap((fs) =>
          pipe(
            // Start the consumer fiber that writes to the file
            pipe(
              Queue.take(queue),
              Effect.flatMap((data) => fs.writeFileString(logPath, data, { flag: "a" })),
              Effect.forever,
              Effect.catchAll((error) =>
                Effect.sync(() => {
                  logger.error(`Log write error: ${error}`);
                })
              ),
              Effect.fork
            ),
            Effect.map((fiber) => ({
              write: (data: string) =>
                pipe(
                  Queue.offer(queue, data),
                  Effect.map(() => void 0)
                ),
              close: () =>
                pipe(
                  Queue.shutdown(queue),
                  Effect.flatMap(() => fiber.await),
                  Effect.timeout("2 seconds"),
                  Effect.map(() => void 0),
                  Effect.catchAll(() => Effect.void)
                ),
            }))
          )
        ),
        Effect.provide(NodeFileSystem.layer)
      )
    ),
    Effect.mapError(
      (cause) =>
        new ProcessError({
          cause,
          operation: "spawn",
        })
    )
  );

/**
 * Setup log handlers for process stdout/stderr
 */
const setupLogHandlers = (
  process: MoonwallProcess,
  logQueue: { write: (data: string) => Effect.Effect<void>; close: () => Effect.Effect<void> }
): Effect.Effect<void> =>
  Effect.sync(() => {
    const logHandler = (chunk: Buffer) => {
      const data = chunk.toString();
      // Fire and forget using Effect.runPromise
      Effect.runPromise(logQueue.write(data)).catch((err) => {
        logger.error(`Failed to queue log data: ${err}`);
      });
    };

    process.stdout?.on("data", logHandler);
    process.stderr?.on("data", logHandler);
  });

/**
 * Setup exit handler using Deferred for synchronization
 */
const setupExitHandler = (
  process: MoonwallProcess,
  logQueue: { write: (data: string) => Effect.Effect<void>; close: () => Effect.Effect<void> },
  logPath: string,
  exitDeferred: Deferred.Deferred<void>
): Effect.Effect<void> =>
  Effect.sync(() => {
    process.once("exit", (code, signal) => {
      const timestamp = new Date().toISOString();
      let message: string;

      if (process.isMoonwallTerminating) {
        message = `${timestamp} [moonwall] process killed. reason: ${process.moonwallTerminationReason || "unknown"}\n`;
      } else if (code !== null) {
        message = `${timestamp} [moonwall] process exited with status code ${code}\n`;
      } else if (signal !== null) {
        message = `${timestamp} [moonwall] process terminated by signal ${signal}\n`;
      } else {
        message = `${timestamp} [moonwall] process terminated unexpectedly\n`;
      }

      // Write exit message and close stream
      const exitEffect = pipe(
        logQueue.write(message),
        Effect.flatMap(() => logQueue.close()),
        Effect.flatMap(() => Deferred.succeed(exitDeferred, undefined)),
        Effect.catchAll((error) =>
          pipe(
            FileSystem.FileSystem,
            Effect.flatMap((fs) => fs.writeFileString(logPath, message, { flag: "a" })),
            Effect.provide(NodeFileSystem.layer),
            Effect.catchAll(() =>
              Effect.sync(() => {
                logger.error(`Failed to write exit message: ${error}`);
              })
            )
          )
        )
      );

      Effect.runPromise(exitEffect);
    });
  });

/**
 * Kill a process gracefully with timeout
 */
const killProcess = (
  process: MoonwallProcess,
  logQueue: { write: (data: string) => Effect.Effect<void>; close: () => Effect.Effect<void> },
  exitDeferred: Deferred.Deferred<void>,
  reason: string
): Effect.Effect<void, ProcessError> =>
  Effect.sync(() => {
    process.isMoonwallTerminating = true;
    process.moonwallTerminationReason = reason;
  }).pipe(
    Effect.flatMap(() =>
      process.pid
        ? pipe(
            Effect.try({
              try: () => process.kill("SIGTERM"),
              catch: (cause) =>
                new ProcessError({
                  cause,
                  pid: process.pid,
                  operation: "kill",
                }),
            }),
            Effect.flatMap(() =>
              pipe(
                Deferred.await(exitDeferred),
                Effect.timeout("5 seconds"),
                Effect.catchAll(() =>
                  pipe(
                    Effect.sync(() => {
                      logger.warn(`Process ${process.pid} exit handler timed out, force closing`);
                    }),
                    Effect.flatMap(() => logQueue.close())
                  )
                )
              )
            )
          )
        : logQueue.close()
    )
  );

/**
 * Launch a process with manual cleanup function
 *
 * This function spawns the process and returns both the process info and a cleanup effect.
 * The cleanup effect should be executed manually when the process needs to be terminated.
 * This allows the process to outlive the Effect scope and remain running for the test suite duration.
 */
const launchProcess = (
  config: ProcessConfig
): Effect.Effect<
  { result: ProcessLaunchResult; cleanup: Effect.Effect<void, ProcessError> },
  NodeLaunchError | ProcessError
> =>
  pipe(
    Effect.all([Path.Path, Effect.sync(() => config.logDirectory || undefined)]),
    Effect.flatMap(([pathService, customLogDir]) => {
      const dirPath = customLogDir || pathService.join(process.cwd(), "tmp", "node_logs");
      return pipe(
        ensureLogDirectory(dirPath),
        Effect.flatMap(() => spawnProcess(config)),
        Effect.flatMap((process) => {
          // Ensure PID is available before proceeding
          if (process.pid === undefined) {
            return Effect.fail(
              new ProcessError({
                cause: new Error("Process PID is undefined after spawn"),
                operation: "spawn",
              })
            );
          }

          return pipe(
            getLogPath(config, process.pid),
            Effect.flatMap((logPath) =>
              pipe(
                createLogQueue(logPath),
                Effect.flatMap((logQueue) =>
                  pipe(
                    Deferred.make<void>(),
                    Effect.flatMap((exitDeferred) =>
                      pipe(
                        setupLogHandlers(process, logQueue),
                        Effect.flatMap(() =>
                          setupExitHandler(process, logQueue, logPath, exitDeferred)
                        ),
                        Effect.map(() => {
                          const processInfo: ProcessLaunchResult = {
                            process,
                            logPath,
                          };

                          // Create cleanup effect that can be called manually later
                          const cleanup = pipe(
                            killProcess(
                              process,
                              logQueue,
                              exitDeferred,
                              "Manual cleanup requested"
                            ),
                            Effect.catchAll((error) =>
                              Effect.sync(() => {
                                logger.error(`Failed to cleanly kill process: ${error}`);
                              })
                            )
                          );

                          return { result: processInfo, cleanup };
                        })
                      )
                    )
                  )
                )
              )
            )
          );
        })
      );
    }),
    Effect.provide(NodePath.layer)
  );

/**
 * Live implementation of ProcessManagerService
 */
export const ProcessManagerServiceLive = Layer.succeed(ProcessManagerService, {
  launch: launchProcess,
});
