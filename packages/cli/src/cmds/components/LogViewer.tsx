import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import chalk from "chalk";
import fs from "node:fs";
import { executeTests } from "../runTests";

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

  const handleGrepSubmit = useCallback(async () => {
    process.env.MOON_RECYCLE = "true";
    process.env.MOON_GREP = grepInput;
    const opts: any = {
      testNamePattern: grepInput,
      silent: true,
      subDirectory: process.env.MOON_SUBDIR,
    };
    opts.reporters = ["dot"];
    
    setIsExecutingCommand(true);
    removeWatcher();
    try {
      await executeTests(env, opts);
    } finally {
      setIsGrepMode(false);
      setIsExecutingCommand(false);
      if (tailing) {
        setupWatcher();
        readLog();
      }
    }
  }, [grepInput, env, tailing]);

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

  const setupWatcher = () => {
    fs.watchFile(logFilePath, () => {
      readLog();
    });
  };

  const removeWatcher = () => {
    fs.unwatchFile(logFilePath);
  };

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

  const readLog = () => {
    if (!tailing) return;

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
        setLogs((prev) => [...prev, ...newContent.split("\n")]);
        setCurrentReadPosition(newReadPosition);
      });
    }
  };

  useEffect(() => {
    // Initial read
    const stats = fs.statSync(logFilePath);
    const stream = fs.createReadStream(logFilePath);
    let content = "";

    stream.on("data", (chunk) => {
      content += chunk.toString();
    });

    stream.on("end", () => {
      setLogs(content.split("\n"));
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
      <Box flexGrow={1} flexDirection="column" marginBottom={-1}>
        {logs.slice(-process.stdout.rows + 1).map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
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
