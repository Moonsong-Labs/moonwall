import type { ChildProcessWithoutNullStreams } from "node:child_process";
/**
 * Wraps a promise with a timeout. If the original promise does not resolve within the specified time, it rejects.
 * @param promise The original promise to wrap.
 * @param ms The timeout duration in milliseconds.
 * @returns A promise that either resolves/rejects with the original promise or rejects with a timeout error.
 */
export declare const withTimeout: <T>(promise: Promise<T>, ms: number) => Promise<T>;
export declare function runTask(
  cmd: string,
  {
    cwd,
    env,
  }?: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
  },
  title?: string
): Promise<string>;
export declare function spawnTask(
  cmd: string,
  {
    cwd,
    env,
  }?: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
  },
  title?: string
): Promise<ChildProcessWithoutNullStreams>;
