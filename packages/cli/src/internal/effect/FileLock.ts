/**
 * Cross-process file lock with staleness detection.
 * Uses atomic mkdir + PID/timestamp metadata to prevent deadlocks.
 */
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import * as os from "node:os";
import { FileLockError } from "./errors.js";

const LOCK_MAX_AGE_MS = 120_000;

interface LockInfo {
  pid: number;
  timestamp: number;
  hostname: string;
}

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const cleanupStaleLock = (lockPath: string): Effect.Effect<void, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const infoPath = `${lockPath}/lock.json`;

    const exists = yield* fs.exists(infoPath).pipe(Effect.orElseSucceed(() => false));
    if (!exists) return;

    const content = yield* fs.readFileString(infoPath).pipe(Effect.orElseSucceed(() => ""));
    const info = yield* Effect.try(() => JSON.parse(content) as LockInfo).pipe(
      Effect.orElseSucceed(() => null)
    );
    if (!info) return;

    const isStale =
      Date.now() - info.timestamp > LOCK_MAX_AGE_MS ||
      (info.hostname === os.hostname() && !isProcessAlive(info.pid));

    if (isStale) {
      yield* fs.remove(lockPath, { recursive: true }).pipe(Effect.ignore);
    }
  });

export const acquireFileLock = (
  lockPath: string,
  timeout = 120_000
): Effect.Effect<void, FileLockError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      yield* cleanupStaleLock(lockPath);

      const acquired = yield* fs.makeDirectory(lockPath).pipe(
        Effect.as(true),
        Effect.catchAll(() => Effect.succeed(false))
      );

      if (acquired) {
        const info: LockInfo = { pid: process.pid, timestamp: Date.now(), hostname: os.hostname() };
        yield* fs
          .writeFileString(`${lockPath}/lock.json`, JSON.stringify(info))
          .pipe(Effect.ignore);
        return;
      }

      yield* Effect.sleep("500 millis");
    }

    yield* Effect.fail(new FileLockError({ reason: "timeout", lockPath }));
  });

export const releaseFileLock = (
  lockPath: string
): Effect.Effect<void, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(lockPath, { recursive: true }).pipe(Effect.ignore);
  });

export const withFileLock = <A, E, R>(
  lockPath: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | FileLockError, R | FileSystem.FileSystem> =>
  Effect.acquireUseRelease(
    acquireFileLock(lockPath),
    () => effect,
    () => releaseFileLock(lockPath)
  );
