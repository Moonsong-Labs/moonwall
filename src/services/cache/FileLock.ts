/**
 * Cross-process file lock with staleness detection.
 * Uses atomic mkdir + PID/timestamp metadata to prevent deadlocks.
 */
import { FileSystem } from "@effect/platform";
import { Duration, Effect, Schedule } from "effect";
import * as os from "node:os";
import { FileLockError } from "../errors.js";

const LOCK_MAX_AGE = Duration.minutes(2);
const LOCK_POLL_INTERVAL = Duration.millis(500);

interface LockInfo {
  pid: number;
  timestamp: number;
  hostname: string;
}

const isProcessAlive = (pid: number): Effect.Effect<boolean> =>
  Effect.try(() => {
    process.kill(pid, 0);
    return true;
  }).pipe(Effect.orElseSucceed(() => false));

const isLockStale = (info: LockInfo) =>
  Effect.gen(function* () {
    const isTimedOut = Date.now() - info.timestamp > Duration.toMillis(LOCK_MAX_AGE);
    if (isTimedOut) return true;

    const isSameHost = info.hostname === os.hostname();
    if (!isSameHost) return false;

    const alive = yield* isProcessAlive(info.pid);
    return !alive;
  });

const cleanupStaleLock = (lockPath: string) =>
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

    const stale = yield* isLockStale(info);
    if (stale) {
      yield* fs.remove(lockPath, { recursive: true }).pipe(Effect.ignore);
    }
  });

const writeLockInfo = (lockPath: string): Effect.Effect<void, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const info: LockInfo = {
      pid: process.pid,
      timestamp: Date.now(),
      hostname: os.hostname(),
    };
    yield* fs.writeFileString(`${lockPath}/lock.json`, JSON.stringify(info)).pipe(Effect.ignore);
  });

/**
 * Single attempt to acquire lock - fails if lock exists
 */
const tryAcquireLock = (lockPath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    // Clean up stale locks before attempting
    yield* cleanupStaleLock(lockPath);

    // Atomic directory creation - fails if exists
    yield* fs
      .makeDirectory(lockPath)
      .pipe(Effect.mapError(() => new FileLockError({ reason: "acquisition_failed", lockPath })));

    // Write lock metadata
    yield* writeLockInfo(lockPath);
  });

export const acquireFileLock = (
  lockPath: string,
  timeout = Duration.minutes(2)
): Effect.Effect<void, FileLockError, FileSystem.FileSystem> =>
  tryAcquireLock(lockPath).pipe(
    Effect.retry(Schedule.fixed(LOCK_POLL_INTERVAL).pipe(Schedule.upTo(timeout))),
    Effect.catchAll(() => Effect.fail(new FileLockError({ reason: "timeout", lockPath })))
  );

export const releaseFileLock = (
  lockPath: string
): Effect.Effect<void, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(lockPath, { recursive: true }).pipe(Effect.ignore);
  });

export const withFileLock = <A, E, R>(
  lockPath: string,
  effect: Effect.Effect<A, E, R>,
  timeout = Duration.minutes(2)
): Effect.Effect<A, E | FileLockError, R | FileSystem.FileSystem> =>
  Effect.acquireUseRelease(
    acquireFileLock(lockPath, timeout),
    () => effect,
    () => releaseFileLock(lockPath)
  );
