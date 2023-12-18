import { ChildProcess, execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import WebSocket from "ws";
import { checkAccess, checkExists } from "./fileCheckers";
import Debug from "debug";
const debug = Debug("global:localNode");

export async function launchNode(cmd: string, args: string[], name: string): Promise<ChildProcess> {
  if (cmd.includes("moonbeam")) {
    await checkExists(cmd);
    checkAccess(cmd);
  }

  const port = args.find((a) => a.includes("port"))?.split("=")[1];
  debug(`\x1b[36mStarting ${name} node on port ${port}...\x1b[0m`);

  const dirPath = path.join(process.cwd(), "tmp", "node_logs");

  const onProcessExit = () => {
    if (runningNode) {
      runningNode.kill();
      runningNode.stderr?.off("data", writeLogToFile);
      runningNode.stdout?.off("data", writeLogToFile);
    }

    if (fsStream) {
      fsStream.end();
    }
  };

  const runningNode = spawn(cmd, args);
  const logLocation = path
    .join(
      dirPath,
      `${path.basename(cmd)}_node_${args.find((a) => a.includes("port"))?.split("=")[1]}_${
        runningNode.pid
      }.log`
    )
    .replaceAll("node_node_undefined", "chopsticks");

  process.env.MOON_LOG_LOCATION = logLocation;

  const fsStream = fs.createWriteStream(logLocation);

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

  process.once("exit", onProcessExit);
  process.once("SIGINT", onProcessExit);

  probe: for (;;) {
    try {
      const ports = await findPortsByPid(runningNode.pid);
      if (ports) {
        for (const port of ports) {
          try {
            await checkWebSocketJSONRPC(port);
            // console.log(`Port ${port} supports WebSocket JSON RPC!`);
            break probe;
          } catch {
            continue;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return runningNode;
}

async function checkWebSocketJSONRPC(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "system_chain",
          params: [],
        })
      );
    });

    ws.on("message", (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.jsonrpc === "2.0" && response.id === 1) {
          resolve(true);
        } else {
          reject(false);
        }
      } catch (e) {
        reject(false);
      }
      ws.close();
    });

    ws.on("error", () => {
      reject(false);
    });
  });
}

async function findPortsByPid(
  pid: number,
  retryCount: number = 600,
  retryDelay: number = 100
): Promise<number[]> {
  for (let i = 0; i < retryCount; i++) {
    try {
      const stdout = execSync(`lsof -i -n -P | grep LISTEN | grep ${pid}`).toString();
      const ports: number[] = [];
      const lines = stdout.split("\n");
      for (const line of lines) {
        const regex = /(?:\*|127\.0\.0\.1):(\d+)/;
        const match = line.match(regex);
        if (match) {
          ports.push(Number(match[1]));
        }
      }

      if (ports.length) {
        return ports;
      }
    } catch (error) {
      if (i === retryCount - 1) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }

  return [];
}
