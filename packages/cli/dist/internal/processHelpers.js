// src/internal/processHelpers.ts
import child_process from "child_process";
import { promisify } from "util";
import { createLogger } from "@moonwall/util";
var logger = createLogger({ name: "actions:runner" });
var debug = logger.debug.bind(logger);
var execAsync = promisify(child_process.exec);
var withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Operation timed out")), ms)),
  ]);
};
async function runTask(
  cmd,
  { cwd, env } = {
    cwd: process.cwd(),
  },
  title
) {
  debug(`${
    title
      ? `Title: ${title}
`
      : ""
  }Running task on directory ${cwd}: ${cmd}
`);
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
async function spawnTask(
  cmd,
  { cwd, env } = {
    cwd: process.cwd(),
  },
  title
) {
  debug(`${
    title
      ? `Title: ${title}
`
      : ""
  }Running task on directory ${process.cwd()}: ${cmd}
`);
  try {
    const process2 = child_process.spawn(
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
    return process2;
  } catch (error) {
    const status = error.status ? `[${error.status}]` : "[Unknown Status]";
    const message = error.message ? `${error.message}` : "No Error Message";
    debug(`Caught exception in command execution. Error[${status}] ${message}
`);
    throw error;
  }
}
export { runTask, spawnTask, withTimeout };
