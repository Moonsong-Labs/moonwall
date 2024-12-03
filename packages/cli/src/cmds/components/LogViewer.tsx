import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import chalk from "chalk";
import fs from "node:fs";
import { executeTests, testRunArgs } from "../runTests";
import { UserConfig } from "vitest/dist/node.js";
import tmp from 'tmp';

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
  const [testOutput, setTestOutput] = useState<(string | JSX.Element)[]>([]);
  const [tailing, setTailing] = useState(true);
  const [currentReadPosition, setCurrentReadPosition] = useState(0);
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

    const cursorCheck = setInterval(hideCursor, 100);

    return () => {
      clearInterval(cursorCheck);
      process.stdout.write('\x1B[?25h');
    };
  }, []);

  const readLog = useCallback(() => {
    if (!tailing || !fs.existsSync(logFilePath)) return;

    try {
      const stats = fs.statSync(logFilePath);
      const newReadPosition = stats.size;

      if (newReadPosition > currentReadPosition) {
        const stream = fs.createReadStream(logFilePath, {
          start: currentReadPosition,
          end: newReadPosition,
        });

        let newContent = "";
        stream.on("data", (chunk) => {
          newContent += chunk.toString();
        });

        stream.on("end", () => {
          const lines = newContent.split("\n")
            .filter(line => line.trim())
            .map(line => line.trimEnd());
          
          setLogs(prev => [...prev, ...lines]);
          setCurrentReadPosition(newReadPosition);
        });

        stream.on("error", (error) => {
          console.error("Error reading log file:", error);
        });
      }
    } catch (error) {
      console.error("Error in readLog:", error);
    }
  }, [tailing, logFilePath, currentReadPosition]);

  const setupWatcher = useCallback(() => {
    fs.watchFile(logFilePath, readLog);
  }, [logFilePath, readLog]);

  const removeWatcher = useCallback(() => {
    fs.unwatchFile(logFilePath);
  }, [logFilePath]);

  const handleGrepSubmit = useCallback(async () => {
    setTestOutput([]);
    process.env.MOON_RECYCLE = "true";
    process.env.MOON_GREP = grepInput;
    const opts: testRunArgs & UserConfig = {
      testNamePattern: grepInput,
      silent: false,
      subDirectory: process.env.MOON_SUBDIR,
      outputFile: tmpFile,
      reporters: ['basic','json'],
      onConsoleLog: (log) => {
        if (!log.includes("has multiple versions, ensure that there is only one installed.")) {
          setTestOutput(prev => [...prev, truncateIfMultiline(log)]);
        }
        return false;
      }
    };
    
    setIsExecutingCommand(true);

    try {
      await executeTests(env, opts);
      const jsonOutput = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
      const testResults = jsonOutput.testResults || [];
      const outputLines: (string | JSX.Element)[] = [];

      const TestSummary: React.FC<{ total: number; passed?: number; failed?: number }> = ({ total, passed, failed }) => (
        <Box borderStyle="arrow" borderColor="gray" padding={1} flexDirection="column">
          <Text>Total Tests: {total}</Text>
          {passed !== undefined && passed > 0 && <Text>Passed: {passed}</Text>}
          {failed !== undefined && failed > 0 && <Text color="red">Failed: {failed}</Text>}
        </Box>
      );

      if (jsonOutput.numTotalTests > 0) {
        outputLines.push(
          <TestSummary 
            total={jsonOutput.numTotalTests} 
            passed={jsonOutput.numPassedTests} 
            failed={jsonOutput.numFailedTests}
          />,
        );
      }

      testResults.forEach((result: any) => {
        result.assertionResults?.forEach((assertion: any) => {
          const duration = assertion.duration ? `+${assertion.duration}ms` : '';
          if (assertion.status === 'passed') {
            outputLines.push(`test:dev_test ${truncateIfMultiline(assertion.title)} ${duration}`);
          } else if (assertion.status === 'failed') {
            outputLines.push(
              `test:dev_test ${truncateIfMultiline(assertion.title)} ${duration}`,
              `Error: ${truncateIfMultiline(assertion.failureMessages?.join(' ') || 'Unknown error')}`
            );
          }
        });

        // Handle test file errors
        if (result.failureMessage) {
          outputLines.push(`Error in ${result.testFilePath}:`, truncateIfMultiline(result.failureMessage));
        }
      });

      setTestOutput(prev => [...prev, ...outputLines]);
    } catch (error: any) {
      setTestOutput(prev => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsExecutingCommand(false);
      setIsGrepMode(false);
      if (tailing) {
        setupWatcher();
      }
    }
  }, [grepInput, env, tailing, setupWatcher]);

  const handleTest = useCallback(async () => {
    setTestOutput([]);
    process.env.MOON_RECYCLE = "true";
    const opts: testRunArgs & UserConfig = {
      silent: false,
      subDirectory: process.env.MOON_SUBDIR,
      outputFile: tmpFile,
      reporters: ['basic','json'],
      onConsoleLog: (log) => {
        if (!log.includes("has multiple versions, ensure that there is only one installed.")) {
            setTestOutput(prev => [...prev, truncateIfMultiline(log)]);
        }
        return false;
      }
    };
    
    setIsExecutingCommand(true);

    try {
      await executeTests(env, opts);
      const jsonOutput = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
      const testResults = jsonOutput.testResults || [];
      const outputLines: (string | JSX.Element)[] = [];

      testResults.forEach((result: any) => {
        result.assertionResults?.forEach((assertion: any) => {
          const duration = assertion.duration ? `+${assertion.duration}ms` : '';
          if (assertion.status === 'passed') {
            outputLines.push(`test:dev_test ${truncateIfMultiline(assertion.title)} ${duration}`);
          } else if (assertion.status === 'failed') {
            outputLines.push(
              `test:dev_test ${truncateIfMultiline(assertion.title)} ${duration}`,
              `Error: ${truncateIfMultiline(assertion.failureMessages?.join(' ') || 'Unknown error')}`
            );
          }
        });

        // Handle test file errors
        if (result.failureMessage) {
          outputLines.push(`Error in ${result.testFilePath}:`, truncateIfMultiline(result.failureMessage));
        }
      });

      setTestOutput(prev => [...prev, ...outputLines]);
      
      // Add summary box at the end
      if (jsonOutput.numTotalTests > 0) {
        setTestOutput(prev => [
          ...prev,
          '',
          <Box borderStyle="arrow" borderColor="gray" padding={1} flexDirection="column">
            <Text>Total Tests: {jsonOutput.numTotalTests}</Text>
            {jsonOutput.numPassedTests > 0 && <Text>Passed: {jsonOutput.numPassedTests}</Text>}
            {jsonOutput.numFailedTests > 0 && <Text>Failed: {jsonOutput.numFailedTests}</Text>}
          </Box>
        ]);
      }
    } catch (error: any) {
      setTestOutput(prev => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsExecutingCommand(false);
      if (tailing) {
        setupWatcher();
      }
    }
  }, [env, tailing, setupWatcher]);

  const truncateIfMultiline = (msg: string) => {
    const maxWidth = process.stdout.columns - 20; // More padding for test output
    if (!msg) return msg;
    
    // If it's a hex string or long number, truncate more aggressively
    if (/^(0x)?[0-9a-f]{32,}/i.test(msg)) {
      return msg.slice(0, 40) + '...';
    }
    
    if (msg.includes('\n') || msg.length > maxWidth) {
      const firstLine = msg.split('\n')[0];
      return firstLine.length > maxWidth ? firstLine.slice(0, maxWidth - 3) + '...' : firstLine + '...';
    }
    return msg;
  };

  const resumePauseProse = [
    `, ${chalk.bgWhite.black("[p]")} Pause tail`,
    `, ${chalk.bgWhite.black("[r]")} Resume tail`,
  ];

  const bottomBarBase = `📜 Tailing Logs, commands: ${chalk.bgWhite.black(
    "[q]"
  )} Quit, ${chalk.bgWhite.black("[t]")} Test, ${chalk.bgWhite.black("[g]")} Grep test`;

  const zombieContent = zombieInfo
    ? `, ${chalk.bgWhite.black("[,]")} Next Log, ${chalk.bgWhite.black(
        "[.]"
      )} Previous Log  | CurrentLog: ${chalk.bgWhite.black(
        `${zombieInfo.currentNode} (${zombieInfo.position}/${zombieInfo.total})`
      )}`
    : "";

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
    // Reset scroll position when switching modes
    if (input === 'g') {
      setTestScrollOffset(0);
    }
  });

  // Control blinking cursor for grep mode
  useEffect(() => {
    const timer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);
    
    return () => {
      clearInterval(timer);
    };
  }, [isGrepMode]);

  useEffect(() => {
    // Initial read
    const stats = fs.statSync(logFilePath);
    const stream = fs.createReadStream(logFilePath);
    let content = "";

    stream.on("data", (chunk) => {
      content += chunk.toString();
    });

    stream.on("end", () => {
      const lines = content.split("\n").filter(line => line.trim());
      setLogs(lines);
      setCurrentReadPosition(stats.size);
    });

    // Watch for changes if tailing is enabled
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
    <Box flexDirection="column" height={process.stdout.rows-1}>
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
          <Box flexGrow={1} flexDirection="column">
          {logs.slice(-Math.max(1, maxVisibleLines)).map((line, i) => (
              <Text key={i}>{line}</Text>
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
            <Box flexGrow={1} flexDirection="column">
              {testOutput.map((line, i) => 
                typeof line === 'string' ? (
                  <Text key={i}>{line}</Text>
                ) : (
                  <Box key={i}>{line}</Box>
                )
              ).slice(testScrollOffset, testScrollOffset + maxVisibleLines)}
              {testOutput.length > maxVisibleLines && (
                <Text color="gray">
                  {`[${Math.round((testScrollOffset / Math.max(1, testOutput.length - maxVisibleLines)) * 100)}% scroll, use ↑/↓ to scroll]`}
                </Text>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Bottom Bar */}
      {!isExecutingCommand && !isGrepMode && (
        <Box flexDirection="column" margin={0} padding={0}>
          <Text>
            {bottomBarBase}
            {resumePauseProse[tailing ? 0 : 1]}
            {zombieContent}
            {testOutput.length > maxVisibleLines && ", use ↑/↓ to scroll test output"}
          </Text>
        </Box>
      )}
      {!isExecutingCommand && isGrepMode && (
        <Box flexDirection="column" margin={0} padding={0}>
          {/* <Text dimColor>{"─".repeat(process.stdout.columns)}</Text> */}
          <Text>
            Pattern to filter (ID/Title) [Enter to submit, Esc to cancel]: <Text color="green">{grepInput}</Text><Text color="green">{showCursor ? "▋" : " "}</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
};
