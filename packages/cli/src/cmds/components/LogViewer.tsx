import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import fs from "node:fs";
import type { Environment } from "@moonwall/types";
import { executeTests } from "../runTests";

interface LogViewerProps {
  env: Environment;
  logFilePath: string;
  onExit: () => void;
  onNextLog?: () => void;
  onPrevLog?: () => void;
  zombieInfo?: {
    currentNode: string;
    position: number;
    total: number;
  };
}

interface TestRun {
  pattern?: string;
  done: boolean;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  env,
  logFilePath,
  onExit,
  onNextLog,
  onPrevLog,
  zombieInfo,
}) => {
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [testing, setTesting] = useState(false);
  const [grepMode, setGrepMode] = useState(false);
  const [grepInput, setGrepInput] = useState(process.env.MOON_GREP ?? "");
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const { exit } = useApp();

  const terminalRows = process.stdout.rows ?? 24;
  const terminalCols = process.stdout.columns ?? 80;

  const showTestPanel = testing || testOutput.length > 0 || testRun !== null;
  const testPanelHeight = showTestPanel ? Math.min(10, Math.max(5, Math.floor(terminalRows / 3))) : 0;
  const logPanelHeight = terminalRows - testPanelHeight - (grepMode ? 5 : 4);
  const visibleLines = Math.max(3, logPanelHeight);
  const testOutputLines = Math.max(1, testPanelHeight - 3);

  const readLogFile = useCallback(() => {
    if (paused || !fs.existsSync(logFilePath)) return;
    try {
      const content = fs.readFileSync(logFilePath, "utf-8");
      setLines(content.split("\n").filter((l) => l.trim()));
    } catch {
      // File may be temporarily unavailable
    }
  }, [logFilePath, paused]);

  useEffect(() => {
    readLogFile();
    if (paused) return;

    fs.watchFile(logFilePath, { interval: 100 }, readLogFile);
    return () => {
      fs.unwatchFile(logFilePath);
    };
  }, [logFilePath, paused, readLogFile]);

  // Hide cursor
  useEffect(() => {
    process.stdout.write("\x1B[?25l");
    return () => {
      process.stdout.write("\x1B[?25h");
    };
  }, []);

  const runTests = useCallback(
    async (pattern?: string) => {
      if (testing) return;
      setTesting(true);
      setTestOutput([]);
      setTestRun({ pattern, done: false });
      process.env.MOON_RECYCLE = "true";
      if (pattern) {
        process.env.MOON_GREP = pattern;
      }

      try {
        await executeTests(env, {
          testNamePattern: pattern,
          silent: true,
          subDirectory: process.env.MOON_SUBDIR,
          reporters: ["dot"],
          onConsoleLog: (log) => {
            if (log.includes("has multiple versions")) return false;
            setTestOutput((prev) => [...prev.slice(-50), log]);
            return false;
          },
        });
      } catch {
        // Test failures are expected
      } finally {
        setTesting(false);
        setTestRun((prev) => (prev ? { ...prev, done: true } : null));
      }
    },
    [env, testing]
  );

  useInput((input, key) => {
    // Grep mode input handling
    if (grepMode) {
      if (key.escape) {
        setGrepMode(false);
        return;
      }
      if (key.return) {
        const pattern = grepInput.trim();
        if (pattern) {
          setGrepMode(false);
          runTests(pattern);
        }
        return;
      }
      if (key.backspace || key.delete) {
        setGrepInput((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setGrepInput((prev) => prev + input);
      }
      return;
    }

    // Normal mode
    if (input === "q") {
      fs.unwatchFile(logFilePath);
      onExit();
      exit();
      return;
    }

    if (input === "p") {
      setPaused(true);
    }

    if (input === "r") {
      setPaused(false);
      setScrollOffset(0);
    }

    if (input === "t" && !testing) {
      runTests();
    }

    if (input === "T" && !testing) {
      setGrepMode(true);
    }

    if (input === "c") {
      setTestOutput([]);
      setTestRun(null);
    }

    const maxOffset = Math.max(0, lines.length - visibleLines);

    if (key.pageUp) {
      setScrollOffset((prev) => Math.min(prev + visibleLines, maxOffset));
    }

    if (key.pageDown) {
      setScrollOffset((prev) => Math.max(prev - visibleLines, 0));
    }

    if (input === "g") {
      setScrollOffset(maxOffset);
    }

    if (input === "G") {
      setScrollOffset(0);
    }

    if (input === "," && onNextLog) {
      fs.unwatchFile(logFilePath);
      onNextLog();
      exit();
    }

    if (input === "." && onPrevLog) {
      fs.unwatchFile(logFilePath);
      onPrevLog();
      exit();
    }
  });

  const startIndex = Math.max(0, lines.length - visibleLines - scrollOffset);
  const visible = lines.slice(startIndex, startIndex + visibleLines);
  const shortPath = logFilePath.split("/").slice(-2).join("/");
  const visibleTestOutput = testOutput.slice(-testOutputLines);

  const getLineColor = (line: string): string => {
    if (/error|panic|fail/i.test(line)) return "red";
    if (/warn/i.test(line)) return "yellow";
    return "white";
  };

  const truncate = (text: string, maxLen: number): string => {
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
  };

  return (
    <Box flexDirection="column" height={terminalRows}>
      {/* Log Panel */}
      <Box borderStyle="single" borderColor={paused ? "yellow" : "green"} paddingX={1}>
        <Text color={paused ? "yellow" : "green"} bold>
          {paused ? "PAUSED" : "LIVE"}
        </Text>
        <Text> </Text>
        <Text dimColor>{shortPath}</Text>
        <Text> </Text>
        <Text dimColor>({lines.length} lines)</Text>
        {zombieInfo && (
          <>
            <Text> </Text>
            <Text color="cyan">
              [{zombieInfo.currentNode} {zombieInfo.position}/{zombieInfo.total}]
            </Text>
          </>
        )}
        {scrollOffset > 0 && (
          <>
            <Text> </Text>
            <Text color="yellow">↑{scrollOffset}</Text>
          </>
        )}
      </Box>

      <Box flexDirection="column" height={visibleLines} paddingX={1}>
        {visible.map((line, i) => (
          <Text key={startIndex + i} color={getLineColor(line)} wrap="truncate">
            {truncate(line, terminalCols - 4)}
          </Text>
        ))}
        {visible.length === 0 && <Text dimColor>Waiting for logs...</Text>}
      </Box>

      {/* Test Panel */}
      {showTestPanel && (
        <Box flexDirection="column" borderStyle="single" borderColor={testing ? "magenta" : "blue"}>
          <Box paddingX={1}>
            <Text color={testing ? "magenta" : "blue"} bold>
              {testing ? "TESTING..." : "TESTS"}
            </Text>
            {testRun && (
              <>
                {testRun.done && (
                  <>
                    <Text> </Text>
                    <Text color="green">done</Text>
                  </>
                )}
                {testRun.pattern && (
                  <>
                    <Text> </Text>
                    <Text dimColor>({testRun.pattern})</Text>
                  </>
                )}
              </>
            )}
          </Box>
          <Box flexDirection="column" height={testOutputLines} paddingX={1} overflow="hidden">
            {visibleTestOutput.map((line, i) => (
              <Text key={i} wrap="truncate" dimColor>
                {truncate(line, terminalCols - 4)}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Footer */}
      {grepMode ? (
        <Box paddingX={1} borderStyle="single" borderColor="cyan">
          <Text color="cyan">Grep pattern: </Text>
          <Text>{grepInput}</Text>
          <Text color="cyan">▋</Text>
          <Text dimColor> (Enter=run, Esc=cancel)</Text>
        </Box>
      ) : (
        <Box paddingX={1}>
          <Text dimColor>
            q:quit t:test T:grep{showTestPanel && " c:clear"} p:pause r:resume g:top G:bottom PgUp/PgDn
            {onNextLog && " ,/.:node"}
          </Text>
        </Box>
      )}
    </Box>
  );
};
