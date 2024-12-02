import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import chalk from "chalk";
import fs from "node:fs";

interface LogViewerProps {
  env: any;
  logFilePath: string;
  onExit: () => void;
  onTest: () => Promise<void>;
  onGrep: () => Promise<void>;
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
  onGrep,
  onNextLog,
  onPrevLog,
  zombieInfo,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [tailing, setTailing] = useState(true);
  const [currentReadPosition, setCurrentReadPosition] = useState(0);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const { exit } = useApp();

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
      setIsExecutingCommand(true);
      removeWatcher();
      onGrep().finally(() => {
        setIsExecutingCommand(false);
        if (tailing) {
          setupWatcher();
          readLog();
        }
      });
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
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} flexDirection="column">
        {logs.slice(-process.stdout.rows + 2).map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
      {!isExecutingCommand && (
        <Box height={1}>
          <Text>
            {bottomBarBase}
            {resumePauseProse[tailing ? 0 : 1]}
            {zombieContent}
          </Text>
        </Box>
      )}
    </Box>
  );
};
