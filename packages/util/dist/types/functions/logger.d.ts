import pino from "pino";
import type { Logger } from "pino";
export interface LoggerOptions {
  name: string;
  level?: string;
  enabled?: boolean;
}
export declare function createLogger(options: LoggerOptions): Logger;
export declare function getLogger(name: string): Logger | undefined;
export declare function clearLoggers(): void;
export declare function setLoggerEnabled(pattern: string, enabled: boolean): void;
export declare function setupLogger(name: string): pino.Logger;
export type { Logger } from "pino";
