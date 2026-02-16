import fs from "node:fs";
import chalk from "chalk";
import os from "node:os";
import path from "node:path";
import { regex } from "arkregex";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import {
  BinaryNotFoundError,
  BinaryArchMismatchError,
  BinaryPermissionError,
  UserAbortError,
} from "../../services/errors.js";
import { CommandRunner, CommandRunnerLive } from "../../services/CommandRunner.js";
import { Prompter, PrompterLive } from "../../services/Prompter.js";

// ─── Constants ──────────────────────────────────────────────────────

const architectureMap: Record<number, string> = {
  0: "unknown",
  3: "x86",
  62: "x64",
  183: "arm64",
};

// ─── Internal Effect Functions ──────────────────────────────────────

/**
 * Read ELF header to determine binary architecture.
 * Sync — reads 20 bytes, testable with real temp files.
 */
export const getBinaryArchitectureEffect = (filePath: string) =>
  Effect.try({
    try: () => {
      const fd = fs.openSync(filePath, "r");
      try {
        const buffer = Buffer.alloc(20);
        fs.readSync(fd, buffer, 0, 20, 0);
        const e_machine = buffer.readUInt16LE(18);
        return architectureMap[e_machine] || "unknown";
      } finally {
        fs.closeSync(fd);
      }
    },
    catch: (cause) =>
      new BinaryNotFoundError({
        path: filePath,
        message: `Failed to read binary architecture: ${cause}`,
      }),
  });

/**
 * Check that a binary exists and matches the system architecture.
 * Uses @effect/platform FileSystem for the existence check.
 */
export const checkExistsEffect = (binPathArg: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const binPath = binPathArg.split(" ")[0];

    const exists = yield* fileSystem.exists(binPath);
    if (!exists) {
      return yield* Effect.fail(
        new BinaryNotFoundError({
          path: binPath,
          message: `No binary file found at location: ${binPath} \n Are you sure your ${chalk.bgWhiteBright.blackBright("moonwall.config.json")} file has the correct "binPath" in launchSpec?`,
        })
      );
    }

    const binArch = yield* getBinaryArchitectureEffect(binPath);
    const currentArch = os.arch();
    if (binArch !== currentArch && binArch !== "unknown") {
      return yield* Effect.fail(
        new BinaryArchMismatchError({
          binaryArch: binArch,
          systemArch: currentArch,
          path: binPath,
        })
      );
    }

    return true as const;
  });

/**
 * Check that a binary has execute permissions.
 * Sync — testable with real temp files.
 */
export const checkAccessEffect = (binPathArg: string) => {
  const binPath = binPathArg.split(" ")[0];
  return Effect.try({
    try: () => {
      fs.accessSync(binPath, fs.constants.X_OK);
    },
    catch: () => {
      console.error(`The file ${binPath} is not executable`);
      return new BinaryPermissionError({ path: binPath });
    },
  });
};

/**
 * Check if a binary is already running via pgrep.
 * pgrep exit status 1 = no processes found (success with empty array).
 */
export const checkAlreadyRunningEffect = (binaryName: string) =>
  Effect.gen(function* () {
    const runner = yield* CommandRunner;
    console.log(`Checking if ${chalk.bgWhiteBright.blackBright(binaryName)} is already running...`);

    const stdout = yield* runner
      .exec(`pgrep -x ${binaryName.slice(0, 14)}`, { timeout: 2000 })
      .pipe(
        Effect.catchIf(
          (e) => e.exitCode === 1,
          () => Effect.succeed("")
        )
      );

    if (!stdout) return [] as number[];
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((pId) => Number.parseInt(pId, 10));
  });

/**
 * Check what ports a process is listening on via lsof.
 * Falls back to `ps` to report the binary name on failure.
 */
export const checkListeningPortsEffect = (processId: number) =>
  Effect.gen(function* () {
    const runner = yield* CommandRunner;

    const stdOut = yield* runner.exec(`lsof -p  ${processId} | grep LISTEN`).pipe(
      Effect.tapError(() =>
        runner.exec(`ps -p ${processId} -o comm=`).pipe(
          Effect.tap((binName) =>
            Effect.sync(() => {
              console.log(
                `Process ${processId}, which is running binary ${binName.trim()}, is unresponsive.`
              );
              console.log(
                "Running Moonwall with this in the background may cause unexpected behaviour. Please manually kill the process and try running Moonwall again."
              );
              console.log(`N.B. You can kill it with: sudo kill -9 ${processId}`);
            })
          ),
          Effect.ignore
        )
      )
    );

    const binName = stdOut.split("\n")[0].split(" ")[0];
    const portRegex = regex(":(\\d+)\\s+\\(LISTEN\\)");
    const ports = stdOut
      .split("\n")
      .filter(Boolean)
      .map((line) => portRegex.exec(line)?.[1])
      .filter(Boolean) as string[];
    const filtered = new Set(ports);
    return { binName, processId, ports: [...filtered].toSorted() };
  });

/**
 * Prompt user to handle already-running processes.
 * Fails with UserAbortError when user selects abort.
 */
export const promptAlreadyRunningEffect = (pids: number[]) =>
  Effect.gen(function* () {
    const runner = yield* CommandRunner;
    const prompter = yield* Prompter;

    const portInfos = yield* Effect.forEach(pids, (pid) => checkListeningPortsEffect(pid));

    const message = portInfos
      .map(
        ({ binName, processId, ports }) =>
          `${binName} - pid: ${processId}, listenPorts: [${ports.join(", ")}]`
      )
      .join("\n");

    const answer = yield* prompter.select({
      message: `The following processes are already running: \n${message}`,
      default: "continue" as const,
      choices: [
        { name: "🪓  Kill processes and continue", value: "kill" as const },
        { name: "➡️   Continue (and let processes live)", value: "continue" as const },
        { name: "🛑  Abort (and let processes live)", value: "abort" as const },
      ],
    });

    switch (answer) {
      case "kill":
        for (const pid of pids) {
          yield* runner.exec(`kill ${pid}`);
        }
        break;

      case "continue":
        break;

      case "abort":
        return yield* Effect.fail(
          new UserAbortError({ cause: "User selected abort", context: "promptAlreadyRunning" })
        );
    }
  });

/**
 * Download missing binaries with interactive prompt.
 * Fails with UserAbortError when user declines download.
 * Fails with BinaryNotFoundError on non-x64 architectures.
 */
export const downloadBinsIfMissingEffect = (binPath: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const runner = yield* CommandRunner;
    const prompter = yield* Prompter;
    const binName = path.basename(binPath);
    const binDir = path.dirname(binPath);
    const exists = yield* fileSystem.exists(binPath);

    if (!exists && process.arch === "x64") {
      const download = yield* prompter.select({
        message: `The binary ${chalk.bgBlack.greenBright(binName)} is missing from ${chalk.bgBlack.greenBright(path.join(process.cwd(), binDir))}.\nWould you like to download it now?`,
        default: true,
        choices: [
          { name: `Yes, download ${binName}`, value: true },
          { name: "No, quit program", value: false },
        ],
      });

      if (!download) {
        return yield* Effect.fail(
          new UserAbortError({ cause: "User declined download", context: "downloadBinsIfMissing" })
        );
      }

      yield* runner.execInherit(`mkdir -p ${binDir}`);
      yield* runner.execInherit(`pnpm moonwall download ${binName} latest ${binDir}`);
    } else if (!exists) {
      console.log(
        `The binary: ${chalk.bgBlack.greenBright(binName)} is missing from: ${chalk.bgBlack.greenBright(path.join(process.cwd(), binDir))}`
      );
      console.log(
        `Given you are running ${chalk.bgBlack.yellowBright(process.arch)} architecture, you will need to build it manually from source 🛠️`
      );
      return yield* Effect.fail(
        new BinaryNotFoundError({
          path: binPath,
          message: "Executable binary not available",
        })
      );
    }
  });

// ─── Public Wrappers (preserve existing caller contract) ────────────

const liveLayers = Layer.mergeAll(NodeFileSystem.layer, CommandRunnerLive, PrompterLive);

export async function checkExists(pathArg: string) {
  return checkExistsEffect(pathArg).pipe(Effect.provide(NodeFileSystem.layer), Effect.runPromise);
}

export function checkAccess(pathArg: string) {
  return checkAccessEffect(pathArg).pipe(Effect.runSync);
}

export function checkAlreadyRunning(binaryName: string): number[] {
  return checkAlreadyRunningEffect(binaryName).pipe(
    Effect.provide(CommandRunnerLive),
    Effect.runSync
  );
}

export function checkListeningPorts(processId: number) {
  return checkListeningPortsEffect(processId).pipe(
    Effect.provide(CommandRunnerLive),
    Effect.runSync
  );
}

export async function promptAlreadyRunning(pids: number[]) {
  return promptAlreadyRunningEffect(pids).pipe(Effect.provide(liveLayers), Effect.runPromise);
}

export async function downloadBinsIfMissing(binPath: string) {
  return downloadBinsIfMissingEffect(binPath).pipe(
    Effect.provide(liveLayers),
    Effect.catchTag(
      "UserAbortError",
      (): Effect.Effect<void> =>
        Effect.sync(() => {
          process.exit(0);
        })
    ),
    Effect.runPromise
  );
}
