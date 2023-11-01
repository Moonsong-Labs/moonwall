import Debug from "debug";
import { execaCommand, execaCommandSync } from "execa";
import path from "path";
import fs from "fs";
import WebSocket from "ws";
import { checkAccess, checkExists } from "./fileCheckers";
const debugNode = Debug("global:node");

export type LaunchedNode = {
  pid: number;
  kill(signal?: NodeJS.Signals | number, options?: object): boolean;
};

export async function launchNode(cmd: string, args: string[], name: string): Promise<LaunchedNode> {
  if (cmd.includes("moonbeam")) {
    await checkExists(cmd);
    checkAccess(cmd);
  }

  const dirPath = path.join(process.cwd(), "tmp", "node_logs");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  debugNode(`Launching dev node: ${name}`);
  const logLocation = path
    .join(
      dirPath,
      `${path.basename(cmd)}_node_${
        args.find((a) => a.includes("port"))?.split("=")[1]
      }_${new Date().getTime()}.log`
    )
    .replaceAll("node_node_undefined", "chopsticks");
  process.env.MOON_LOG_LOCATION = logLocation;

  const runningNode = execaCommand(`${cmd} ${args.join(" ")}`, {
    all: true,
    cleanup: false,
    detached: false,
  }).pipeAll(logLocation);

  probe: for (;;) {
    try {
      const ports = findPortsByPid(runningNode.pid);
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

  return { pid: runningNode.pid, kill: runningNode.kill };
}

const WEB_SOCKET_TIMEOUT = 5000; // e.g., 5 seconds

// async function checkWebSocketJSONRPC(port: number): Promise<boolean> {
//   return new Promise((resolve, reject) => {
//     const ws = new WebSocket(`ws://localhost:${port}`);
//     const timeout = setTimeout(() => {
//       ws.close();
//       reject(new Error("WebSocket response timeout"));
//     }, WEB_SOCKET_TIMEOUT);

//     ws.once("open", () => {
//       ws.send(
//         JSON.stringify({
//           jsonrpc: "2.0",
//           id: 1,
//           method: "system_chain",
//           params: [],
//         })
//       );
//     });

//     ws.once("message", (data) => {
//       clearTimeout(timeout);
//       try {
//         const { jsonrpc, id } = JSON.parse(data.toString());
//         if (jsonrpc === "2.0" && id === 1) {
//           resolve(true);
//         } else {
//           reject(new Error("Invalid JSON-RPC response"));
//         }
//       } catch (e) {
//         reject(new Error("Failed to parse WebSocket message"));
//       } finally {
//         ws.close();
//       }
//     });

//     ws.once("error", (err) => {
//       clearTimeout(timeout);
//       ws.close();
//       reject(new Error(`WebSocket error: ${err.message}`));
//     });
//   });
// }

async function checkWebSocketJSONRPC(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket response timeout"));
    }, WEB_SOCKET_TIMEOUT);

    const openHandler = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "system_chain",
          params: [],
        })
      );
    };

    const messageHandler = (data: string) => {
      clearTimeout(timeout);
      try {
        const { jsonrpc, id } = JSON.parse(data.toString());
        if (jsonrpc === "2.0" && id === 1) {
          resolve(true);
        } else {
          reject(new Error("Invalid JSON-RPC response"));
        }
      } catch (e) {
        reject(new Error("Failed to parse WebSocket message"));
      } finally {
        ws.removeListener("error", errorHandler);
        ws.close();
      }
    };

    const errorHandler = (err: Error) => {
      clearTimeout(timeout);
      ws.removeListener("open", openHandler);
      ws.removeListener("message", messageHandler);
      ws.close();
      reject(new Error(`WebSocket error: ${err.message}`));
    };

    ws.once("open", openHandler);
    ws.once("message", messageHandler);
    ws.once("error", errorHandler);
  });
}

function findPortsByPid(pid: number, retryDelay: number = 10000) {
  for (;;) {
    const command = `lsof -i -n -P | grep LISTEN | grep ${pid} || true`;
    const { stdout } = execaCommandSync(command, { shell: true, cleanup: true });
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

    const end = Date.now() + retryDelay;
    if (Date.now() > end) break;
  }

  return [];
}
