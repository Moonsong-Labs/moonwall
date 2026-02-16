import fs from "node:fs";
import { execSync } from "node:child_process";
import chalk from "chalk";
import os from "node:os";
import path from "node:path";
import { select } from "@inquirer/prompts";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import {
  BinaryNotFoundError,
  BinaryArchMismatchError,
  BinaryPermissionError,
  ProcessError,
  UserAbortError,
} from "../../services/errors.js";

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
 * Sync — reads 20 bytes, no need for full FileSystem service.
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
 */
export const checkAccessEffect = (binPathArg: string) =>
  Effect.try({
    try: () => {
      const binPath = binPathArg.split(" ")[0];
      fs.accessSync(binPath, fs.constants.X_OK);
    },
    catch: () => {
      const binPath = binPathArg.split(" ")[0];
      console.error(`The file ${binPath} is not executable`);
      return new BinaryPermissionError({ path: binPath });
    },
  });

/**
 * Check if a binary is already running via pgrep.
 * pgrep exit status 1 = no processes found (success with empty array).
 */
export const checkAlreadyRunningEffect = (binaryName: string) =>
  Effect.try({
    try: () => {
      console.log(
        `Checking if ${chalk.bgWhiteBright.blackBright(binaryName)} is already running...`
      );
      // pgrep only supports 15 characters
      const stdout = execSync(`pgrep -x ${binaryName.slice(0, 14)}`, {
        encoding: "utf8",
        timeout: 2000,
      });
      return stdout
        .split("\n")
        .filter(Boolean)
        .map((pId) => Number.parseInt(pId, 10));
    },
    catch: (cause) => new ProcessError({ cause, operation: "pgrep" }),
  }).pipe(
    Effect.catchIf(
      (e) => (e.cause as any)?.status === 1,
      () => Effect.succeed([] as number[])
    )
  );

/**
 * Check what ports a process is listening on via lsof.
 * Falls back to `ps` to report the binary name on failure.
 */
export const checkListeningPortsEffect = (processId: number) =>
  Effect.try({
    try: () => {
      const stdOut = execSync(`lsof -p  ${processId} | grep LISTEN`, {
        encoding: "utf-8",
      });
      const binName = stdOut.split("\n")[0].split(" ")[0];
      const ports = stdOut
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const port = line.split(":")[1];
          return port.split(" ")[0];
        });
      const filtered = new Set(ports);
      return { binName, processId, ports: [...filtered].sort() };
    },
    catch: (cause) => new ProcessError({ cause, pid: processId, operation: "lsof" }),
  }).pipe(
    Effect.tapError(() =>
      Effect.sync(() => {
        try {
          const binName = execSync(`ps -p ${processId} -o comm=`).toString().trim();
          console.log(
            `Process ${processId} is running which for binary ${binName}, however it is unresponsive.`
          );
          console.log(
            "Running Moonwall with this in the background may cause unexpected behaviour. Please manually kill the process and try running Moonwall again."
          );
          console.log(`N.B. You can kill it with: sudo kill -9 ${processId}`);
        } catch {
          // ps command also failed — nothing more we can do
        }
      })
    )
  );

/**
 * Prompt user to handle already-running processes.
 * Fails with UserAbortError when user selects abort.
 */
export const promptAlreadyRunningEffect = (pids: number[]) =>
  Effect.gen(function* () {
    const portInfos = yield* Effect.forEach(pids, (pid) => checkListeningPortsEffect(pid));

    const message = portInfos
      .map(
        ({ binName, processId, ports }) =>
          `${binName} - pid: ${processId}, listenPorts: [${ports.join(", ")}]`
      )
      .join("\n");

    const answer = yield* Effect.tryPromise({
      try: () =>
        select({
          message: `The following processes are already running: \n${message}`,
          default: "continue",
          choices: [
            { name: "🪓  Kill processes and continue", value: "kill" as const },
            { name: "➡️   Continue (and let processes live)", value: "continue" as const },
            { name: "🛑  Abort (and let processes live)", value: "abort" as const },
          ],
        }),
      catch: (cause) => new UserAbortError({ cause, context: "promptAlreadyRunning" }),
    });

    switch (answer) {
      case "kill":
        for (const pid of pids) {
          yield* Effect.try({
            try: () => execSync(`kill ${pid}`),
            catch: (cause) => new ProcessError({ cause, pid, operation: "kill" }),
          });
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
    const binName = path.basename(binPath);
    const binDir = path.dirname(binPath);
    const exists = yield* fileSystem.exists(binPath);

    if (!exists && process.arch === "x64") {
      const download = yield* Effect.tryPromise({
        try: () =>
          select({
            message: `The binary ${chalk.bgBlack.greenBright(binName)} is missing from ${chalk.bgBlack.greenBright(path.join(process.cwd(), binDir))}.\nWould you like to download it now?`,
            default: true,
            choices: [
              { name: `Yes, download ${binName}`, value: true },
              { name: "No, quit program", value: false },
            ],
          }),
        catch: (cause) => new UserAbortError({ cause, context: "downloadBinsIfMissing" }),
      });

      if (!download) {
        return yield* Effect.fail(
          new UserAbortError({ cause: "User declined download", context: "downloadBinsIfMissing" })
        );
      }

      yield* Effect.try({
        try: () => {
          execSync(`mkdir -p ${binDir}`);
          execSync(`pnpm moonwall download ${binName} latest ${binDir}`, {
            stdio: "inherit",
          });
        },
        catch: (cause) =>
          new BinaryNotFoundError({
            path: binPath,
            message: `Download failed: ${cause}`,
          }),
      });
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

export async function checkExists(pathArg: string) {
  return checkExistsEffect(pathArg).pipe(Effect.provide(NodeFileSystem.layer), Effect.runPromise);
}

export function checkAccess(pathArg: string) {
  return checkAccessEffect(pathArg).pipe(Effect.runSync);
}

export function checkAlreadyRunning(binaryName: string): number[] {
  return checkAlreadyRunningEffect(binaryName).pipe(Effect.runSync);
}

export function checkListeningPorts(processId: number) {
  return checkListeningPortsEffect(processId).pipe(Effect.runSync);
}

export async function promptAlreadyRunning(pids: number[]) {
  return promptAlreadyRunningEffect(pids).pipe(Effect.runPromise);
}

export async function downloadBinsIfMissing(binPath: string) {
  return downloadBinsIfMissingEffect(binPath).pipe(
    Effect.provide(NodeFileSystem.layer),
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
