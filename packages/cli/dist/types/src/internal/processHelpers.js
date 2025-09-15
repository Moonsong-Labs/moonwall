import child_process from "node:child_process";
import { promisify } from "node:util";
import { createLogger } from "@moonwall/util";
const logger = createLogger({ name: "actions:runner" });
const debug = logger.debug.bind(logger);
const execAsync = promisify(child_process.exec);
/**
 * Wraps a promise with a timeout. If the original promise does not resolve within the specified time, it rejects.
 * @param promise The original promise to wrap.
 * @param ms The timeout duration in milliseconds.
 * @returns A promise that either resolves/rejects with the original promise or rejects with a timeout error.
 */
export const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Operation timed out")), ms)),
  ]);
};
// Execute process and return the output
export async function runTask(
  cmd,
  { cwd, env } = {
    cwd: process.cwd(),
  },
  title
) {
  debug(`${title ? `Title: ${title}\n` : ""}Running task on directory ${cwd}: ${cmd}\n`);
  try {
    const result = await execAsync(cmd, { cwd, env });
    return result.stdout;
  } catch (error) {
    const status = error.status ? `[${error.status}]` : "[Unknown Status]";
    const message = error.message ? `${error.message}` : "No Error Message";
    debug(`Caught exception in command execution. Error[${status}] ${message}`);
    throw error;
  }
}
// Execute process return the emitter instantly, without wait
export async function spawnTask(
  cmd,
  { cwd, env } = {
    cwd: process.cwd(),
  },
  title
) {
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
  } catch (error) {
    const status = error.status ? `[${error.status}]` : "[Unknown Status]";
    const message = error.message ? `${error.message}` : "No Error Message";
    debug(`Caught exception in command execution. Error[${status}] ${message}\n`);
    throw error;
  }
}
//# sourceMappingURL=processHelpers.js.map
