import { ChildProcess, spawn } from "child_process";
import chalk from "chalk";
import Debug from "debug";
import { checkAccess, checkExists } from "./fileCheckers";
import fs from "fs";
import path from "path";
const debugNode = Debug("global:node");

export async function launchNode(cmd: string, args: string[], name: string): Promise<ChildProcess> {
  if (cmd.includes("moonbeam")) {
    await checkExists(cmd);
    checkAccess(cmd);
  }

  let runningNode: ChildProcess;

  const dirPath = path.join(process.cwd(), "tmp", "node_logs");

  const onProcessExit = () => {
    runningNode && runningNode.kill();
  };
  const onProcessInterrupt = () => {
    runningNode && runningNode.kill();
  };

  process.once("exit", onProcessExit);
  process.once("SIGINT", onProcessInterrupt);

  runningNode = spawn(cmd, args);

  const fsStream = fs.createWriteStream(
    path.join(
      dirPath,
      `${path.basename(cmd)}_node_${args.find((a) => a.includes("port"))?.split("=")[1]}_${
        runningNode.pid
      }.log`
    )
  );

  runningNode.once("exit", () => {
    process.removeListener("exit", onProcessExit);
    process.removeListener("SIGINT", onProcessInterrupt);

    runningNode.stderr?.off("data", writeLogToFile);
    runningNode.stdout?.off("data", writeLogToFile);

    fsStream.end(); // This line ensures that the writable stream is properly closed
    debugNode(`Exiting dev node: ${name}`);
  });

  runningNode.on("error", (err) => {
    if ((err as any).errno == "ENOENT") {
      console.error(
        `\x1b[31mMissing Local binary at` + `(${cmd}).\nPlease compile the project\x1b[0m`
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  const writeLogToFile = (chunk: any) => {
    if (fsStream.writable) {
      fsStream.write(chunk, (err) => {
        if (err) console.error(err);
        else fsStream.emit("drain");
      });
    }
  };
  runningNode.stderr?.on("data", writeLogToFile);
  runningNode.stdout?.on("data", writeLogToFile);

  const binaryLogs: any[] = [];
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.error(chalk.redBright("Failed to start Test Node."));
      console.error(`Command: ${cmd} ${args.join(" ")}`);
      console.error(`Logs:`);
      console.error(binaryLogs.map((chunk) => chunk.toString()).join("\n"));
      reject("Failed to launch node");
    }, 60000);

    const onData = async (chunk: any) => {
      debugNode(chunk.toString());

      binaryLogs.push(chunk);
      if (
        chunk.toString().match(/Development Service Ready/) ||
        chunk.toString().match(/ RPC listening on port/)
      ) {
        clearTimeout(timer);
        runningNode.stderr!.off("data", onData);
        runningNode.stdout!.off("data", onData);
        resolve();
      }
    };
    runningNode.stderr!.on("data", onData);
    runningNode.stdout!.on("data", onData);
  });

  return runningNode;
}
