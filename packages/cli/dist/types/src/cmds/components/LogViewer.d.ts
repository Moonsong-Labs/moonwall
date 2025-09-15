import React from "react";
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
export declare const LogViewer: React.FC<LogViewerProps>;
export {};
