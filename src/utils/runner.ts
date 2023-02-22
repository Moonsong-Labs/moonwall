import child_process from "child_process";
import { promisify } from "node:util";
import Debug from "debug";
import { ChildProcessWithoutNullStreams } from "node:child_process";
const debug = Debug("actions:runner");
const execAsync = promisify(child_process.exec);

// Execute process and return the output
export async function runTask(
  cmd: string,
  { cwd, env }: { cwd: string; env?: NodeJS.ProcessEnv } = { cwd: process.cwd() },
  title?: string
): Promise<string> {
  debug(`${title ? `Title: ${title}\n` : ""}Running task on directory ${cwd}: ${cmd}\n`);
  try {
    const result = await execAsync(cmd, { cwd, env });
    return result.stdout;
  } catch (error) {
    console.log(error);
    debug(`Caught exception in command execution. Error[${error.status}] ${error.message}\n`);
    throw error;
  }
}

// Execute process return the emitter instantly, without wait
export async function spawnTask(
  cmd: string,
  { cwd, env }: { cwd: string; env?: NodeJS.ProcessEnv } = { cwd: process.cwd() },
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
  } catch (error) {
    console.log(error);
    debug(`Caught exception in command execution. Error[${error.status}] ${error.message}\n`);
    throw error;
  }
}
