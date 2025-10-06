import { Context, Effect, Layer, pipe } from "effect";
import { Path } from "@effect/platform";
import { NodePath } from "@effect/platform-node";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import type { WriteStream } from "node:fs";
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

const createLogStream = (logPath: string): Effect.Effect<WriteStream, ProcessError> =>
  Effect.try({
    try: () => fs.createWriteStream(logPath, { flags: "a" }),
    catch: (cause) =>
      new ProcessError({
        cause,
        operation: "spawn",
      }),
  });

/**
 * Setup log handlers for process stdout/stderr using native WriteStream
 */
const setupLogHandlers = (process: MoonwallProcess, logStream: WriteStream): Effect.Effect<void> =>
  Effect.sync(() => {
    const logHandler = (chunk: Buffer) => {
      logStream.write(chunk);
    };

    process.stdout?.on("data", logHandler);
    process.stderr?.on("data", logHandler);
  });

/**
 * Helper to construct exit message based on exit context
 */
const constructExitMessage = (
  process: MoonwallProcess,
  code: number | null,
  signal: string | null
): string => {
  const timestamp = new Date().toISOString();

  if (process.isMoonwallTerminating) {
    return `${timestamp} [moonwall] process killed. reason: ${process.moonwallTerminationReason || "unknown"}\n`;
  }
  if (code !== null) {
    return `${timestamp} [moonwall] process closed with status code ${code}\n`;
  }
  if (signal !== null) {
    return `${timestamp} [moonwall] process terminated by signal ${signal}\n`;
  }
  return `${timestamp} [moonwall] process closed unexpectedly\n`;
};

/**
 * Setup exit handler using native WriteStream
 * The stream naturally survives Effect runtime shutdown
 */
const setupExitHandler = (process: MoonwallProcess, logStream: WriteStream): Effect.Effect<void> =>
  Effect.sync(() => {
    process.once("close", (code, signal) => {
      const message = constructExitMessage(process, code, signal);
      logStream.end(message);
    });
  });

/**
 * Kill a process gracefully with timeout
 */
const killProcess = (
  process: MoonwallProcess,
  logStream: WriteStream,
  reason: string
): Effect.Effect<void, ProcessError> =>
  Effect.sync(() => {
    process.isMoonwallTerminating = true;
    process.moonwallTerminationReason = reason;
  }).pipe(
    Effect.flatMap(() =>
      process.pid
        ? Effect.try({
            try: () => {
              process.kill("SIGTERM");
              // Give process time to exit and trigger close handler
              // Close handler will write final message and close stream
            },
            catch: (cause) =>
              new ProcessError({
                cause,
                pid: process.pid,
                operation: "kill",
              }),
          })
        : Effect.sync(() => logStream.end())
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
        Effect.flatMap((childProcess) => {
          // Ensure PID is available before proceeding
          if (childProcess.pid === undefined) {
            return Effect.fail(
              new ProcessError({
                cause: new Error("Process PID is undefined after spawn"),
                operation: "spawn",
              })
            );
          }

          return pipe(
            getLogPath(config, childProcess.pid),
            Effect.flatMap((logPath) =>
              pipe(
                createLogStream(logPath),
                Effect.flatMap((logStream) =>
                  pipe(
                    setupLogHandlers(childProcess, logStream),
                    Effect.flatMap(() => setupExitHandler(childProcess, logStream)),
                    Effect.map(() => {
                      const processInfo: ProcessLaunchResult = {
                        process: childProcess,
                        logPath,
                      };

                      // Create cleanup effect that can be called manually later
                      const cleanup = pipe(
                        killProcess(childProcess, logStream, "Manual cleanup requested"),
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
