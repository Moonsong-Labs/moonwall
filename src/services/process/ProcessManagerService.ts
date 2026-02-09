import { Context, Effect, Fiber, Layer, pipe, Stream } from "effect";
import { FileSystem, Path } from "@effect/platform";
import { NodeFileSystem, NodePath, NodeStream } from "@effect/platform-node";
import { spawn, type ChildProcess } from "node:child_process";
import { regex } from "arkregex";
import { NodeLaunchError, ProcessError } from "../errors.js";
import { createLogger } from "../../util/index.js";

/** Matches the artifact of node_node_undefined in log paths */
const nodeUndefinedRegex = regex("node_node_undefined", "g");

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
 * Service for spawning child processes.
 * Wraps node:child_process.spawn — the one thing @effect/platform can't handle
 * (Command.start uses acquireRelease which kills on scope close).
 */
export class Spawner extends Context.Tag("Spawner")<
  Spawner,
  {
    readonly spawn: (
      command: string,
      args: ReadonlyArray<string>
    ) => Effect.Effect<MoonwallProcess, NodeLaunchError>;
  }
>() {}

/**
 * Live implementation using node:child_process.spawn
 */
export const SpawnerLive = Layer.succeed(Spawner, {
  spawn: (command, args) =>
    Effect.try({
      try: () => {
        const child = spawn(command, [...args]) as MoonwallProcess;
        child.on("error", (error) => {
          logger.error(`Process spawn error: ${error}`);
        });
        return child;
      },
      catch: (cause) =>
        new NodeLaunchError({
          cause,
          command,
          args: [...args],
        }),
    }),
});

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
const getLogPath = (
  config: ProcessConfig,
  pid: number
): Effect.Effect<string, ProcessError, Path.Path> =>
  pipe(
    Effect.all([Path.Path, Effect.sync(() => process.cwd())]),
    Effect.map(([pathService, cwd]) => {
      const dirPath = config.logDirectory || pathService.join(cwd, "tmp", "node_logs");
      const portArg = config.args.find((a) => a.includes("port"));
      const port = portArg?.split("=")[1] || "unknown";
      const baseName = pathService.basename(config.command);

      return pathService
        .join(dirPath, `${baseName}_node_${port}_${pid}.log`)
        .replace(nodeUndefinedRegex, "chopsticks");
    }),
    Effect.mapError(
      (cause) =>
        new ProcessError({
          cause,
          operation: "spawn",
        })
    )
  );

/**
 * Ensure log directory exists using @effect/platform FileSystem
 */
const ensureLogDirectory = (
  dirPath: string
): Effect.Effect<void, ProcessError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dirExists = yield* fs.exists(dirPath);
    if (!dirExists) {
      yield* fs.makeDirectory(dirPath, { recursive: true });
    }
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ProcessError({
          cause,
          operation: "spawn",
        })
    )
  );

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
 * Setup log pipeline: merge stdout+stderr → file sink, forked as background fiber.
 * Fiber completes naturally when the process closes (readable streams end → sink flushes).
 */
const setupLogging = (
  child: MoonwallProcess,
  logPath: string
): Effect.Effect<Fiber.Fiber<void>, ProcessError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const onError = (err: unknown) => new ProcessError({ cause: err, operation: "spawn" as const });

    const stdout = child.stdout
      ? NodeStream.fromReadable<ProcessError>(() => child.stdout!, onError)
      : Stream.empty;

    const stderr = child.stderr
      ? NodeStream.fromReadable<ProcessError>(() => child.stderr!, onError)
      : Stream.empty;

    // Merge stdout+stderr and pipe to file sink (append mode), forked to run in background.
    // Errors are ignored before forking — log pipeline failures are non-fatal,
    // and killProcess already ignores the fiber join result.
    const fiber = yield* Stream.merge(stdout, stderr).pipe(
      Stream.run(fs.sink(logPath, { flag: "a" })),
      Effect.ignore,
      Effect.fork
    );

    // Setup exit handler that writes final message on close
    yield* Effect.sync(() => {
      child.once("close", (code, signal) => {
        const message = constructExitMessage(child, code, signal);
        // Write final exit message — use appendFileSync since streams are closed
        try {
          const nodeFs = require("node:fs");
          nodeFs.appendFileSync(logPath, message);
        } catch {
          // Best effort — process is closing anyway
        }
      });
    });

    return fiber;
  });

/**
 * Kill a process gracefully, joining log fiber to drain remaining output
 */
const killProcess = (
  child: MoonwallProcess,
  logFiber: Fiber.Fiber<void>,
  reason: string
): Effect.Effect<void, ProcessError> =>
  Effect.sync(() => {
    child.isMoonwallTerminating = true;
    child.moonwallTerminationReason = reason;
  }).pipe(
    Effect.flatMap(() =>
      child.pid
        ? Effect.try({
            try: () => {
              child.kill("SIGTERM");
            },
            catch: (cause) =>
              new ProcessError({
                cause,
                pid: child.pid,
                operation: "kill",
              }),
          })
        : Effect.void
    ),
    // Wait for log fiber to drain remaining output and close file
    Effect.flatMap(() => Fiber.join(logFiber).pipe(Effect.ignore))
  );

/**
 * Internal launch logic with explicit dependencies in R channel
 */
const launchProcessInternal = (
  config: ProcessConfig
): Effect.Effect<
  { result: ProcessLaunchResult; cleanup: Effect.Effect<void, ProcessError> },
  NodeLaunchError | ProcessError,
  Spawner | FileSystem.FileSystem | Path.Path
> =>
  pipe(
    Effect.all([Path.Path, Effect.sync(() => config.logDirectory || undefined)]),
    Effect.flatMap(([pathService, customLogDir]) => {
      const dirPath = customLogDir || pathService.join(process.cwd(), "tmp", "node_logs");
      return pipe(
        ensureLogDirectory(dirPath),
        Effect.flatMap(() =>
          Spawner.pipe(Effect.flatMap((spawner) => spawner.spawn(config.command, config.args)))
        ),
        Effect.flatMap((childProcess) => {
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
                setupLogging(childProcess, logPath),
                Effect.map((logFiber) => {
                  const processInfo: ProcessLaunchResult = {
                    process: childProcess,
                    logPath,
                  };

                  const cleanup = pipe(
                    killProcess(childProcess, logFiber, "Manual cleanup requested"),
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
    })
  );

/**
 * Launch process with all live dependencies provided
 */
const launchProcess = (
  config: ProcessConfig
): Effect.Effect<
  { result: ProcessLaunchResult; cleanup: Effect.Effect<void, ProcessError> },
  NodeLaunchError | ProcessError
> =>
  launchProcessInternal(config).pipe(
    Effect.provide(SpawnerLive),
    Effect.provide(NodeFileSystem.layer),
    Effect.provide(NodePath.layer)
  );

/**
 * Live implementation of ProcessManagerService
 */
export const ProcessManagerServiceLive = Layer.succeed(ProcessManagerService, {
  launch: launchProcess,
});

/**
 * Test factory: provide custom Spawner and/or FileSystem layers.
 * Follows the same pattern as makeNodeReadinessServiceTest.
 */
export const makeProcessManagerServiceTest = (
  spawnerLayer: Layer.Layer<Spawner>,
  fsLayer?: Layer.Layer<FileSystem.FileSystem>
): Layer.Layer<ProcessManagerService> =>
  Layer.succeed(ProcessManagerService, {
    launch: (config) =>
      launchProcessInternal(config).pipe(
        Effect.provide(spawnerLayer),
        Effect.provide(fsLayer ?? NodeFileSystem.layer),
        Effect.provide(NodePath.layer)
      ),
  });
