import { Effect, Context, Layer, Scope } from "effect";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
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
  readonly logStream: fs.WriteStream;
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
 * Create log directory if it doesn't exist (async)
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
 * Generate log file path for a process
 */
const getLogPath = (config: ProcessConfig, pid: number): string => {
  const dirPath = config.logDirectory || path.join(process.cwd(), "tmp", "node_logs");
  const portArg = config.args.find((a) => a.includes("port"));
  const port = portArg?.split("=")[1] || "unknown";
  const baseName = path.basename(config.command);

  return path
    .join(dirPath, `${baseName}_node_${port}_${pid}.log`)
    .replace(/node_node_undefined/g, "chopsticks");
};

/**
 * Spawn a child process
 */
const spawnProcess = (config: ProcessConfig): Effect.Effect<MoonwallProcess, NodeLaunchError> =>
  Effect.try({
    try: () => {
      const child = spawn(config.command, [...config.args]) as MoonwallProcess;
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
 * Setup log stream for a process
 */
const setupLogStream = (
  process: MoonwallProcess,
  logPath: string
): Effect.Effect<fs.WriteStream, ProcessError> =>
  Effect.try({
    try: () => {
      const stream = fs.createWriteStream(logPath);

      const logHandler = (chunk: Buffer) => {
        if (stream.writable) {
          stream.write(chunk, (err) => {
            if (err) console.error(err);
          });
        }
      };

      process.stderr?.on("data", logHandler);
      process.stdout?.on("data", logHandler);

      return stream;
    },
    catch: (cause) =>
      new ProcessError({
        cause,
        pid: process.pid,
        operation: "spawn",
      }),
  });

/**
 * Setup exit handler for process
 */
const setupExitHandler = (
  process: MoonwallProcess,
  logStream: fs.WriteStream,
  logPath: string
): Effect.Effect<void, ProcessError> =>
  Effect.sync(() => {
    process.once("exit", (code, signal) => {
      const timestamp = new Date().toISOString();
      let message: string;

      if (process.isMoonwallTerminating) {
        message = `${timestamp} [moonwall] process killed. reason: ${process.moonwallTerminationReason || "unknown"}`;
      } else if (code !== null) {
        message = `${timestamp} [moonwall] process exited with status code ${code}`;
      } else if (signal !== null) {
        message = `${timestamp} [moonwall] process terminated by signal ${signal}`;
      } else {
        message = `${timestamp} [moonwall] process terminated unexpectedly`;
      }

      if (logStream.writable) {
        logStream.write(`${message}\n`, (err) => {
          if (err) console.error(`Failed to write exit message to log: ${err}`);
          logStream.end();
        });
      } else {
        try {
          fs.appendFileSync(logPath, `${message}\n`);
        } catch (err) {
          console.error(`Failed to append exit message to log file: ${err}`);
        }
        logStream.end();
      }
    });
  });

/**
 * Kill a process gracefully
 */
const killProcess = (
  process: MoonwallProcess,
  logStream: fs.WriteStream,
  reason: string
): Effect.Effect<void, ProcessError> =>
  Effect.try({
    try: () => {
      process.isMoonwallTerminating = true;
      process.moonwallTerminationReason = reason;

      if (process.pid) {
        process.kill("SIGTERM");
      }

      logStream.end();
    },
    catch: (cause) =>
      new ProcessError({
        cause,
        pid: process.pid,
        operation: "kill",
      }),
  });

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
> => {
  const dirPath = config.logDirectory || path.join(process.cwd(), "tmp", "node_logs");

  return ensureLogDirectory(dirPath).pipe(
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
      const logPath = getLogPath(config, process.pid);
      return setupLogStream(process, logPath).pipe(
        Effect.flatMap((logStream) =>
          setupExitHandler(process, logStream, logPath).pipe(
            Effect.map(() => {
              const processInfo: ProcessLaunchResult = {
                process,
                logStream,
                logPath,
              };
              // Create cleanup effect that can be called manually later
              const cleanup = killProcess(process, logStream, "Manual cleanup requested").pipe(
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
      );
    })
  );
};

/**
 * Live implementation of ProcessManagerService
 */
export const ProcessManagerServiceLive = Layer.succeed(ProcessManagerService, {
  launch: launchProcess,
});
