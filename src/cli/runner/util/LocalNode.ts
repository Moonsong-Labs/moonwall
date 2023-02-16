import { spawn } from "child_process";
import { MoonwallContext } from "../internal/globalContext.js";
import chalk from "chalk"
import Debug from "debug"
const debugNode = Debug("global:node");

export async function launchDevNode(
  cmd: string,
  args: string[],
  name: string
): Promise<void> {
    const nodesList = MoonwallContext.getContext().nodes;
    const currentNode = nodesList.length + 1;
    nodesList[currentNode] = null;
    const onProcessExit = () => {
      nodesList[currentNode] && nodesList[currentNode].kill();
    };
    const onProcessInterrupt = () => {
      process.exit(2);
    };
    process.once("exit", onProcessExit);
    process.once("SIGINT", onProcessInterrupt);
    nodesList[currentNode] = spawn(cmd, args);

    nodesList[currentNode].once("exit", () => {
      process.removeListener("exit", onProcessExit);
      process.removeListener("SIGINT", onProcessInterrupt);
      debugNode(`Exiting dev node: ${name}`);
    });

    nodesList[currentNode].on("error", (err) => {
      if ((err as any).errno == "ENOENT") {
        console.error(
          `\x1b[31mMissing Moonbeam binary at` +
            `(${cmd}).\nPlease compile the Moonbeam project\x1b[0m`
        );
      } else {
        console.error(err);
      }
      process.exit(1);
    });

    const binaryLogs: any[] = [];
    return await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        console.error(chalk.redBright("Failed to start Moonbeam Test Node."));
        console.error(`Command: ${cmd} ${args.join(" ")}`);
        console.error(`Logs:`);
        console.error(binaryLogs.map((chunk) => chunk.toString()).join("\n"));
        reject("Failed to launch node")
      }, 10000);

      const onData = async (chunk: any) => {
        debugNode(chunk.toString());

        binaryLogs.push(chunk);
        if (chunk.toString().match(/Development Service Ready/) || chunk.toString().match(/ RPC listening on port/)) {
          clearTimeout(timer);
          if (true) {
            nodesList[currentNode].stderr.off("data", onData);
            nodesList[currentNode].stdout.off("data", onData);
          }
          resolve();
        }
      };
      nodesList[currentNode].stderr.on("data", onData);
      nodesList[currentNode].stdout.on("data", onData);
    });


}
