import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Duration, Effect, Exit } from "effect";
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
    it("should acquire lock by creating directory", async () => {
      const program = acquireFileLock(lockPath, Duration.seconds(5)).pipe(
        Effect.provide(NodeFileSystem.layer)
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
      expect(fs.existsSync(lockPath)).toBe(true);
      expect(fs.existsSync(path.join(lockPath, "lock.json"))).toBe(true);

      // Verify lock.json contains correct metadata
      const lockInfo = JSON.parse(fs.readFileSync(path.join(lockPath, "lock.json"), "utf-8"));
      expect(lockInfo.pid).toBe(process.pid);
      expect(lockInfo.hostname).toBe(os.hostname());
      expect(typeof lockInfo.timestamp).toBe("number");
    });

    it("should fail with timeout if lock already held", async () => {
      // Manually create a lock held by current process
      fs.mkdirSync(lockPath);
      fs.writeFileSync(
        path.join(lockPath, "lock.json"),
        JSON.stringify({ pid: process.pid, timestamp: Date.now(), hostname: os.hostname() })
      );

      const program = acquireFileLock(lockPath, Duration.seconds(1)).pipe(
        Effect.provide(NodeFileSystem.layer)
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
        expect(exit.cause.error).toBeInstanceOf(FileLockError);
      }
    });
  });

  describe("releaseFileLock", () => {
    it("should remove lock directory", async () => {
      // Create a lock first
      fs.mkdirSync(lockPath);
      fs.writeFileSync(path.join(lockPath, "lock.json"), "{}");

      const program = releaseFileLock(lockPath).pipe(Effect.provide(NodeFileSystem.layer));

      await Effect.runPromise(program);
      expect(fs.existsSync(lockPath)).toBe(false);
    });

    it("should not fail if lock does not exist", async () => {
      const program = releaseFileLock(lockPath).pipe(Effect.provide(NodeFileSystem.layer));

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  describe("staleness detection", () => {
    it("should clean up lock from dead process", async () => {
      // Create a lock with a non-existent PID
      fs.mkdirSync(lockPath);
      fs.writeFileSync(
        path.join(lockPath, "lock.json"),
        JSON.stringify({ pid: 999999, timestamp: Date.now(), hostname: os.hostname() })
      );

      const program = acquireFileLock(lockPath, Duration.seconds(5)).pipe(
        Effect.provide(NodeFileSystem.layer)
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);

      // Should have acquired the lock (old one cleaned up)
      const lockInfo = JSON.parse(fs.readFileSync(path.join(lockPath, "lock.json"), "utf-8"));
      expect(lockInfo.pid).toBe(process.pid);
    });

    it("should clean up expired lock regardless of PID", async () => {
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

      const program = acquireFileLock(lockPath, Duration.seconds(5)).pipe(
        Effect.provide(NodeFileSystem.layer)
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isSuccess(exit)).toBe(true);

      // Should have acquired a fresh lock
      const lockInfo = JSON.parse(fs.readFileSync(path.join(lockPath, "lock.json"), "utf-8"));
      expect(lockInfo.timestamp).toBeGreaterThan(Date.now() - 5000);
    });

    it("should NOT clean up valid lock from different host", async () => {
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

      const program = acquireFileLock(lockPath, Duration.seconds(1)).pipe(
        Effect.provide(NodeFileSystem.layer)
      );

      // Should timeout because we can't verify the PID on a different host
      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("withFileLock", () => {
    it("should execute effect while holding lock and release after", async () => {
      let executed = false;

      const program = withFileLock(
        lockPath,
        Effect.sync(() => {
          executed = true;
          expect(fs.existsSync(lockPath)).toBe(true);
          return "result";
        })
      ).pipe(Effect.provide(NodeFileSystem.layer));

      const result = await Effect.runPromise(program);
      expect(executed).toBe(true);
      expect(result).toBe("result");
      expect(fs.existsSync(lockPath)).toBe(false); // Lock released
    });

    it("should release lock even if effect fails", async () => {
      const program = withFileLock(lockPath, Effect.fail(new Error("test error"))).pipe(
        Effect.provide(NodeFileSystem.layer)
      );

      const exit = await Effect.runPromiseExit(program);
      expect(Exit.isFailure(exit)).toBe(true);
      expect(fs.existsSync(lockPath)).toBe(false); // Lock still released
    });
  });
});
