import child_process from "node:child_process";
import { promisify } from "node:util";
import { createLogger } from "../../util/index.js";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
const logger = createLogger({ name: "actions:runner" });
const debug = logger.debug.bind(logger);
const execAsync = promisify(child_process.exec);

/**
 * Wraps a promise with a timeout. If the original promise does not resolve within the specified time, it rejects.
 * @param promise The original promise to wrap.
 * @param ms The timeout duration in milliseconds.
 * @returns A promise that either resolves/rejects with the original promise or rejects with a timeout error.
 */
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Operation timed out")), ms)
    ),
  ]);
};

// Execute process and return the output
export async function runTask(
  cmd: string,
  { cwd, env }: { cwd: string; env?: NodeJS.ProcessEnv } = {
    cwd: process.cwd(),
  },
  title?: string
): Promise<string> {
  debug(`${title ? `Title: ${title}\n` : ""}Running task on directory ${cwd}: ${cmd}\n`);
  try {
    const result = await execAsync(cmd, { cwd, env });
    return result.stdout;
  } catch (error: any) {
    const status = error.status ? `[${error.status}]` : "[Unknown Status]";
    const message = error.message ? `${error.message}` : "No Error Message";
    debug(`Caught exception in command execution. Error[${status}] ${message}`);
    throw error;
  }
}

// Execute process return the emitter instantly, without wait
export async function spawnTask(
  cmd: string,
  { cwd, env }: { cwd: string; env?: NodeJS.ProcessEnv } = {
    cwd: process.cwd(),
  },
  title?: string
): Promise<ChildProcessWithoutNullStreams> {
  debug(`${title ? `Title: ${title}\n` : ""}Running task on directory ${process.cwd()}: ${cmd}\n`);
  try {
    const process = child_process.spawn(
      cmd.split(" ")[0],
      cmd
        .split(" ")
        .slice(1)
        .filter((a) => a.length > 0),
      {
        cwd,
        env,
      }
    );
    return process;
  } catch (error: any) {
    const status = error.status ? `[${error.status}]` : "[Unknown Status]";
    const message = error.message ? `${error.message}` : "No Error Message";
    debug(`Caught exception in command execution. Error[${status}] ${message}\n`);
    throw error;
  }
}
