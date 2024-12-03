import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import chalk from "chalk";
import fs from "node:fs";
import { executeTests, testRunArgs } from "../runTests";
import { UserConfig } from "vitest/dist/node.js";

interface LogViewerProps {
  env: any;
  logFilePath: string;
  onExit: () => void;
  onTest: () => Promise<void>;
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
  onTest,
  onNextLog,
  onPrevLog,
  zombieInfo,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [tailing, setTailing] = useState(true);
  const [currentReadPosition, setCurrentReadPosition] = useState(0);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [isGrepMode, setIsGrepMode] = useState(false);
  const [grepInput, setGrepInput] = useState(process.env.MOON_GREP || "D01T01");
  const [showCursor, setShowCursor] = useState(true);
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
    process.env.MOON_RECYCLE = "true";
    process.env.MOON_GREP = grepInput;
    const opts: testRunArgs & UserConfig  = {
      testNamePattern: grepInput,
      subDirectory: process.env.MOON_SUBDIR,
      silent: false,
      reporters: ["basic"],
      onConsoleLog: (log: string)=> {
        if (!log.includes("has multiple versions, ensure that there is only one installed.")) {
        setTestOutput(prev => [...prev, log]);
        }
        return false;
      },
      onStackTrace: (error, frame) =>{
        setTestOutput(prev => [...prev, error.message]);
        return false;
      }
    };
    
    setIsExecutingCommand(true);
    setTestOutput([]); // Clear previous test output
    removeWatcher();

    try {
      await executeTests(env, opts);
    } finally {
      setIsGrepMode(false);
      setIsExecutingCommand(false);
      if (tailing) {
        setupWatcher();
      }
    }
  }, [grepInput, env, tailing, setupWatcher, removeWatcher]);

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
      setIsExecutingCommand(true);
      removeWatcher();
      onTest().finally(() => {
        setIsExecutingCommand(false);
        if (tailing) {
          setupWatcher();
          readLog();
        }
      });
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

  return (
    <Box flexDirection="column" height={process.stdout.rows}>
      <Box flexDirection="row" flexGrow={1}>
        {/* Logs Section */}
        <Box 
          flexDirection="column" 
          width={testOutput.length > 0 ? "60%" : "100%"} 
          borderStyle="round" 
          borderColor="blue"
        >
          <Box paddingX={1}>
            <Text bold>Node Logs</Text>
          </Box>
          <Box flexGrow={1} flexDirection="column">
            {logs.slice(-Math.floor(process.stdout.rows * 0.6)).map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
          </Box>
        </Box>

        {/* Test Output Section - Only show if there's output */}
        {testOutput.length > 0 && (
          <Box flexDirection="column" width="40%" borderStyle="round" borderColor="yellow">
            <Box paddingX={1}>
              <Text bold>Test Output</Text>
            </Box>
            <Box flexGrow={1} flexDirection="column">
              {testOutput.slice(-Math.floor(process.stdout.rows * 0.6)).map((line, i) => (
                <Text key={i}>{line}</Text>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Bottom Bar */}
      {!isExecutingCommand && !isGrepMode && (
        <Box flexDirection="column" margin={0} padding={0}>
          <Text dimColor>{"─".repeat(process.stdout.columns)}</Text>
          <Text>
            {bottomBarBase}
            {resumePauseProse[tailing ? 0 : 1]}
            {zombieContent}
          </Text>
        </Box>
      )}
      {!isExecutingCommand && isGrepMode && (
        <Box flexDirection="column" margin={0} padding={0}>
          <Text dimColor>{"─".repeat(process.stdout.columns)}</Text>
          <Text>
            Pattern to filter (ID/Title) [Enter to submit, Esc to cancel]: <Text color="green">{grepInput}</Text><Text color="green">{showCursor ? "▋" : " "}</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
};
