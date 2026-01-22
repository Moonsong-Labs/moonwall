import { describeSuite, expect } from "moonwall";
import { execSync } from "node:child_process";
import assert from "node:assert";
import fs from "node:fs";
import { setTimeout as timer } from "node:timers/promises";

describeSuite({
  id: "EX01",
  title: "Test exit code logging by killing the process",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    let logPath: string | undefined;
    let pid: number | undefined;

    it({
      id: "T01",
      title: "Get process info and verify node is running",
      test: async () => {
        // Get the log location
        logPath = process.env.MOON_LOG_LOCATION;
        expect(logPath).to.exist;
        log(`Log file: ${logPath}`);

        const logFilename = logPath?.split("/").pop();
        assert(logFilename, "Log filename is undefined");
        const parts = logFilename.split("_");
        pid = Number.parseInt(parts[parts.length - 1].replace(".log", ""));

        expect(pid).to.be.greaterThan(0);
        log(`Process PID: ${pid}`);

        try {
          execSync(`ps -p ${pid}`, { stdio: "ignore" });
          log("✓ Process is running");
        } catch {
          throw new Error("Process not found");
        }

        await context.createBlock();
      },
    });

    it({
      id: "T02",
      title: "Kill the process with SIGTERM and check log",
      test: async () => {
        if (!pid || !logPath) {
          throw new Error("PID or log path not set");
        }

        // Read current log size
        const initialSize = fs.statSync(logPath).size;
        log(`Initial log size: ${initialSize} bytes`);

        // Kill the process with SIGTERM
        log(`Killing process ${pid} with SIGTERM...`);
        try {
          execSync(`kill -TERM ${pid}`);
        } catch (e) {
          // Process might have already exited
          log("Kill command completed");
        }

        // Wait for process to die and logs to be written
        await timer(2000);

        // Check if process is dead
        try {
          execSync(`ps -p ${pid}`, { stdio: "ignore" });
          log("⚠️ Process still running after kill");
        } catch {
          log("✓ Process terminated");
        }

        // Read the log file
        const logContent = fs.readFileSync(logPath, "utf-8");
        const newSize = fs.statSync(logPath).size;
        log(`New log size: ${newSize} bytes`);

        // Get the last few lines
        const lines = logContent.trim().split("\n");
        const lastLines = lines.slice(-10);

        log("\nLast 10 lines of log:");
        // biome-ignore lint/suspicious/useIterableCallbackReturn: <its fine>
        lastLines.forEach((line) => log(`  ${line}`));

        // Check for exit message
        const exitMessage = lastLines.find((line) => line.includes("[moonwall]"));

        if (exitMessage) {
          log(`\n✓ Found exit message: ${exitMessage}`);

          // Verify it contains expected content
          expect(exitMessage).to.include("[moonwall]");
          expect(exitMessage).to.match(/process (exited|killed|terminated)/);
        } else {
          log("\n❌ No exit message found");
          throw new Error("Exit message not found in log");
        }
      },
    });
  },
});
