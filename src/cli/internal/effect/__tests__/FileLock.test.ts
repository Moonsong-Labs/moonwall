import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Duration, Effect } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { acquireFileLock, releaseFileLock, withFileLock, FileLockError } from "../index.js";
import { NodeFileSystem } from "@effect/platform-node";

describe("FileLock", () => {
  let testDir: string;
  let lockPath: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "filelock-test-"));
    lockPath = path.join(testDir, "test.lock");
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("acquireFileLock", () => {
    it.live("should acquire lock by creating directory", () =>
      acquireFileLock(lockPath, Duration.seconds(5)).pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.map(() => {
          expect(fs.existsSync(lockPath)).toBe(true);
          expect(fs.existsSync(path.join(lockPath, "lock.json"))).toBe(true);

          // Verify lock.json contains correct metadata
          const lockInfo = JSON.parse(fs.readFileSync(path.join(lockPath, "lock.json"), "utf-8"));
          expect(lockInfo.pid).toBe(process.pid);
          expect(lockInfo.hostname).toBe(os.hostname());
          expect(typeof lockInfo.timestamp).toBe("number");
        })
      )
    );

    it.live(
      "should fail with timeout if lock already held",
      () => {
        // Manually create a lock held by current process
        fs.mkdirSync(lockPath);
        fs.writeFileSync(
          path.join(lockPath, "lock.json"),
          JSON.stringify({ pid: process.pid, timestamp: Date.now(), hostname: os.hostname() })
        );

        return acquireFileLock(lockPath, Duration.seconds(1)).pipe(
          Effect.provide(NodeFileSystem.layer),
          Effect.flip,
          Effect.map((error) => {
            expect(error).toBeInstanceOf(FileLockError);
          })
        );
      },
      { timeout: 15000 }
    );
  });

  describe("releaseFileLock", () => {
    it.live("should remove lock directory", () => {
      // Create a lock first
      fs.mkdirSync(lockPath);
      fs.writeFileSync(path.join(lockPath, "lock.json"), "{}");

      return releaseFileLock(lockPath).pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.map(() => {
          expect(fs.existsSync(lockPath)).toBe(false);
        })
      );
    });

    it.live("should not fail if lock does not exist", () =>
      releaseFileLock(lockPath).pipe(Effect.provide(NodeFileSystem.layer))
    );
  });

  describe("staleness detection", () => {
    it.live("should clean up lock from dead process", () => {
      // Create a lock with a non-existent PID
      fs.mkdirSync(lockPath);
      fs.writeFileSync(
        path.join(lockPath, "lock.json"),
        JSON.stringify({ pid: 999999, timestamp: Date.now(), hostname: os.hostname() })
      );

      return acquireFileLock(lockPath, Duration.seconds(5)).pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.map(() => {
          // Should have acquired the lock (old one cleaned up)
          const lockInfo = JSON.parse(fs.readFileSync(path.join(lockPath, "lock.json"), "utf-8"));
          expect(lockInfo.pid).toBe(process.pid);
        })
      );
    });

    it.live("should clean up expired lock regardless of PID", () => {
      // Create a lock with old timestamp (expired)
      fs.mkdirSync(lockPath);
      fs.writeFileSync(
        path.join(lockPath, "lock.json"),
        JSON.stringify({
          pid: process.pid, // Same PID but expired
          timestamp: Date.now() - 130_000, // 130 seconds ago (> 120s max age)
          hostname: os.hostname(),
        })
      );

      return acquireFileLock(lockPath, Duration.seconds(5)).pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.map(() => {
          // Should have acquired a fresh lock
          const lockInfo = JSON.parse(fs.readFileSync(path.join(lockPath, "lock.json"), "utf-8"));
          expect(lockInfo.timestamp).toBeGreaterThan(Date.now() - 5000);
        })
      );
    });

    it.live(
      "should NOT clean up valid lock from different host",
      () => {
        // Create a lock from a "different host" - can't verify PID
        fs.mkdirSync(lockPath);
        fs.writeFileSync(
          path.join(lockPath, "lock.json"),
          JSON.stringify({
            pid: 12345,
            timestamp: Date.now(), // Fresh timestamp
            hostname: "other-host.local", // Different host
          })
        );

        return acquireFileLock(lockPath, Duration.seconds(1)).pipe(
          Effect.provide(NodeFileSystem.layer),
          Effect.flip,
          // Should timeout because we can't verify the PID on a different host
          Effect.map(() => {})
        );
      },
      { timeout: 15000 }
    );
  });

  describe("withFileLock", () => {
    it.live("should execute effect while holding lock and release after", () => {
      let executed = false;

      return withFileLock(
        lockPath,
        Effect.sync(() => {
          executed = true;
          expect(fs.existsSync(lockPath)).toBe(true);
          return "result";
        })
      ).pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.map((result) => {
          expect(executed).toBe(true);
          expect(result).toBe("result");
          expect(fs.existsSync(lockPath)).toBe(false); // Lock released
        })
      );
    });

    it.live("should release lock even if effect fails", () =>
      withFileLock(lockPath, Effect.fail(new Error("test error"))).pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.flip,
        Effect.map(() => {
          expect(fs.existsSync(lockPath)).toBe(false); // Lock still released
        })
      )
    );
  });
});
