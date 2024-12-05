import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp, Static, Spacer } from "ink";
import chalk from "chalk";
import fs from "node:fs";
import { executeTests, testRunArgs } from "../runTests";
import { UserConfig } from "vitest/dist/node.js";
import tmp from 'tmp';
import { JsonTestResults } from "vitest/reporters"

interface LogViewerProps {
  env: any;
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

export const LogViewer: React.FC<LogViewerProps> = ({
  env,
  logFilePath,
  onExit,
  onNextLog,
  onPrevLog,
  zombieInfo,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [parsedOutput, setParsedOutput] = useState<JsonTestResults>();
  const [tailing, setTailing] = useState(true);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [isGrepMode, setIsGrepMode] = useState(false);
  const [grepInput, setGrepInput] = useState(process.env.MOON_GREP || "D01T01");
  const [showCursor, setShowCursor] = useState(true);
  const [tmpFile] = useState(() => {
    const tmpobj = tmp.fileSync({ prefix: 'moonwall-test-', postfix: '.json' });
    return tmpobj.name;
  });
  const [testScrollOffset, setTestScrollOffset] = useState(0);
  const maxVisibleLines = process.stdout.rows - 6;
  const { exit } = useApp();

  useEffect(() => {
    const hideCursor = () => {
      process.stdout.write('\x1B[?25l');
    };

    hideCursor();
    setupWatcher()

    const cursorCheck = setInterval(hideCursor, 100);

    return () => {
      clearInterval(cursorCheck);
      process.stdout.write('\x1B[?25h');
    };
  }, []);

  const readLog = useCallback(() => {
    if (!tailing || !fs.existsSync(logFilePath)) return;

    try {
      const fileContent = fs.readFileSync(logFilePath, 'utf-8');
      const lines = fileContent.split("\n")
        .filter(line => line.trim())
        .map(line => line.trimEnd());

      setLogs(lines);
    } catch (error) {
      console.error("Error in readLog:", error);
    }
  }, [tailing, logFilePath]);

  const setupWatcher = useCallback(() => {
    readLog();
    fs.watchFile(logFilePath, { interval: 100 }, (curr, prev) => {
      if (curr.size !== prev.size) {
        readLog();
      }
    });
  }, [logFilePath, readLog]);

  const removeWatcher = useCallback(() => {
    fs.unwatchFile(logFilePath);
  }, [logFilePath]);

  const handleGrepSubmit = useCallback(async () => {
    setTestOutput([]);
    setParsedOutput(undefined);
    process.env.MOON_RECYCLE = "true";
    process.env.MOON_GREP = grepInput;
    const opts: testRunArgs & UserConfig = {
      testNamePattern: grepInput,
      silent: false,
      subDirectory: process.env.MOON_SUBDIR,
      outputFile: tmpFile,
      reporters: ['basic', 'json'],
      onConsoleLog: (log) => {
        if (!log.includes("has multiple versions, ensure that there is only one installed.")) {
          setTestOutput(prev => [...prev, log]);
        }
        return false;
      }
    };

    setIsExecutingCommand(true);

    try {
      await executeTests(env, opts);
      const jsonOutput = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
      setParsedOutput(jsonOutput);
    } catch (error: any) {
      setTestOutput(prev => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsExecutingCommand(false);
      setIsGrepMode(false);
      if (tailing) {
        setupWatcher();
      }
    }
  }, [grepInput, env, tailing]);

  const handleTest = useCallback(async () => {
    setTestOutput([]);
    setParsedOutput(undefined);
    process.env.MOON_RECYCLE = "true";
    const opts: testRunArgs & UserConfig = {
      silent: false,
      subDirectory: process.env.MOON_SUBDIR,
      outputFile: tmpFile,
      reporters: ['dot', 'json'],
      onConsoleLog: (log) => {
        if (!log.includes("has multiple versions, ensure that there is only one installed.")) {
          setTestOutput(prev => [...prev, log]);
        }
        return false;
      }
    };

    setIsExecutingCommand(true);

    try {
      await executeTests(env, opts);
      const jsonOutput = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));

      setParsedOutput(jsonOutput);

    } catch (error: any) {
      setTestOutput(prev => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsExecutingCommand(false);
      if (tailing) {
        setupWatcher();
      }
    }
  }, [env, tailing, setupWatcher]);

  useInput((input, key) => {
    if (isGrepMode) {
      if (key.return) {
        handleGrepSubmit();
      } else if (key.escape) {
        setIsGrepMode(false);
      } else if (key.backspace || key.delete) {
        setGrepInput(prev => prev.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setGrepInput(prev => prev + input);
      }
      return;
    }

    if (input === "q") {
      fs.unwatchFile(logFilePath);
      onExit();
      exit();
    }

    if (input === "p") {
      setTailing(false);
      removeWatcher();
    }

    if (input === "r") {
      setTailing(true);
      setupWatcher();
      readLog();
    }

    if (input === "t") {
      handleTest();
    }

    if (input === "g") {
      setIsGrepMode(true);
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

    if (key.upArrow && testOutput.length > 0) {
      setTestScrollOffset(prev => Math.min(prev + 1, Math.max(0, testOutput.length - maxVisibleLines)));
    }
    if (key.downArrow && testOutput.length > 0) {
      setTestScrollOffset(prev => Math.max(0, prev - 1));
    }
    if (input === 'g') {
      setTestScrollOffset(0);
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, [isGrepMode]);

  useEffect(() => {
    const stream = fs.createReadStream(logFilePath);
    let content = "";

    stream.on("data", (chunk) => {
      content += chunk.toString();
    });

    stream.on("end", () => {
      const lines = content.split("\n").filter(line => line.trim());
      setLogs(lines);
    });

    if (tailing) {
      setupWatcher();
    }

    return () => {
      removeWatcher();
    };
  }, [logFilePath, tailing]);

  useEffect(() => {
    setTestScrollOffset(0);
  }, [testOutput.length]);

  return (
    <Box flexDirection="column" height={process.stdout.rows - 1}>
      <Box flexDirection="row" flexGrow={1}>
        {/* Logs Section */}
        <Box
          flexDirection="column"
          width={testOutput.length > 0 ? "60%" : "100%"}
          borderStyle="round"
          borderColor="blue"
          height={process.stdout.rows - 3}
        >

          <Box paddingX={1}>
            <Text backgroundColor="blue" color="black" bold>
              {" " + logFilePath.split("/").slice(-2).join("/") + " "}
            </Text>
          </Box>

          <Box flexGrow={1} flexDirection="column" padding={1}>
            {logs.slice(-Math.max(1, maxVisibleLines)).map((line, i) => (
              <Text key={i} wrap="wrap">{line}</Text>
            ))}
          </Box>
        </Box>

        {/* Test Output Section - Only show if there's output */}
        {testOutput.length > 0 && (
          <Box
            flexDirection="column"
            width="40%"
            borderStyle="round"
            borderColor="yellow"
            height={process.stdout.rows - 3}
          >
            <Box paddingX={1}>
              <Text backgroundColor="yellow" color="black" bold>
                {" Test Output "}
              </Text>
            </Box>

            <Box flexDirection="column" padding={1} height={process.stdout.rows - 5}>
              <Box flexGrow={1} flexDirection="column" overflow="hidden">
                {testOutput.map((line, i) => (
                  <Text key={i} wrap="wrap">{line}</Text>
                )).slice(testScrollOffset, testScrollOffset + maxVisibleLines)}
              </Box>
              {testOutput.length > maxVisibleLines && (
                <Text color="gray">
                  {`[${Math.round((testScrollOffset / Math.max(1, testOutput.length - maxVisibleLines)) * 100)}% scroll, use ↑/↓ to scroll]`}
                </Text>
              )}
              {parsedOutput && (
                <Box 
                  borderStyle="singleDouble" 
                  borderColor={!parsedOutput.success ? "red" : "green"} 
                  flexDirection="column" 
                  minHeight={4}
                >
                  <Text>
                    {`${parsedOutput.numPassedTests}/${parsedOutput.numTotalTests} tests passed`}
                    {parsedOutput.numFailedTests > 0 ? ` (${parsedOutput.numFailedTests} failed)` : ""}
                  </Text>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Bottom Bar */}
      {!isExecutingCommand && !isGrepMode && (
        <Box flexDirection="column" margin={0} padding={0}>
          <Text>
            {`📜 Tailing Logs, commands: ${chalk.bgWhite.black("[q]")} Quit, ${chalk.bgWhite.black("[t]")} Test, ${chalk.bgWhite.black("[g]")} Grep test`}
            {`, ${chalk.bgWhite.black("[p]")} Pause tail`}
            {`, ${chalk.bgWhite.black("[r]")} Resume tail`}
            {zombieInfo
              ? `, ${chalk.bgWhite.black("[,]")} Next Log, ${chalk.bgWhite.black("[.]")} Previous Log  | CurrentLog: ${chalk.bgWhite.black(`${zombieInfo.currentNode} (${zombieInfo.position}/${zombieInfo.total})`)}`
              : ""}
            {testOutput.length > maxVisibleLines && ", use ↑/↓ to scroll test output"}
          </Text>
        </Box>
      )}
      {!isExecutingCommand && isGrepMode && (
        <Box flexDirection="column" margin={0} padding={0}>
          <Text>
            Pattern to filter (ID/Title) [Enter to submit, Esc to cancel]: <Text color="green">{grepInput}</Text><Text color="green">{showCursor ? "▋" : " "}</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
};
