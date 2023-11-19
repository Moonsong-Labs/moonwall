import Debug from "debug";
import { execaCommand } from "execa";
import path from "path";
import fs from "fs";
import WebSocket from "ws";
import { checkAccess, checkExists } from "./fileCheckers";
import { Effect, pipe } from "effect";
import * as Err from "../errors";
const debugNode = Debug("global:node");

export type LaunchedNode = {
  pid: number;
  kill(signal?: NodeJS.Signals | number, options?: object): boolean;
};

export const launchNodeEffect = (cmd: string, args: string[]) =>
  Effect.gen(function* (_) {
    if (cmd.includes("moonbeam")) {
      yield* _(Effect.promise(() => checkExists(cmd)));
      yield* _(Effect.sync(() => checkAccess(cmd)));
    }

    const dirPath = path.join(process.cwd(), "tmp", "node_logs");
    if (yield* _(Effect.sync(() => !fs.existsSync(dirPath)))) {
      yield* _(Effect.sync(() => fs.mkdirSync(dirPath, { recursive: true })));
    }

    const logLocation = path
      .join(
        dirPath,
        `${path.basename(cmd)}_node_${args
          .find((a) => a.includes("port"))
          ?.split("=")[1]}_${new Date().getTime()}.log`
      )
      .replaceAll("node_node_undefined", "chopsticks");

    process.env.MOON_LOG_LOCATION = logLocation;

    const runningNode = yield* _(
      Effect.sync(() =>
        execaCommand(`${cmd} ${args.join(" ")}`, {
          all: true,
          cleanup: true,
          detached: true,
        }).pipeAll(logLocation)
      )
    );

    probe: for (;;) {
      const ports = yield* _(findPortsByPidEffect(runningNode.pid));
      if (ports) {
        for (const port of ports) {
          if (yield* _(checkWebSocketJSONRPCEffect(port))) {
            break probe;
          }
        }
      }
    }
    console.log("this is runningNode.pid", runningNode.pid);
    return { pid: runningNode.pid, kill: runningNode.kill } satisfies LaunchedNode;
  });

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
      `${path.basename(cmd)}_node_${args
        .find((a) => a.includes("port"))
        ?.split("=")[1]}_${new Date().getTime()}.log`
    )
    .replaceAll("node_node_undefined", "chopsticks");
  process.env.MOON_LOG_LOCATION = logLocation;

  const runningNode = execaCommand(`${cmd} ${args.join(" ")}`, {
    all: true,
    cleanup: true,
    detached: true,
  }).pipeAll(logLocation);

  // TODO: When we turn this into an effect, kill if timeout reached
  probe: for (;;) {
    const ports = await Effect.runPromise(findPortsByPidEffect(runningNode.pid));
    if (ports) {
      for (const port of ports) {
        if (await Effect.runPromise(checkWebSocketJSONRPCEffect(port))) {
          break probe;
        }
      }
    }
  }
  console.log("this is runningNode.pid", runningNode.pid);
  return { pid: runningNode.pid, kill: runningNode.kill };
}

const jsonRpcMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "system_chain",
  params: [],
};

const checkWebSocketJSONRPCEffect = (port: number) =>
  pipe(
    Effect.promise(
      () =>
        new Promise((resolve, reject) => {
          const ws = new WebSocket(`ws://127.0.0.1:${port}`) as WebSocket;
          ws.on("open", () => {
            resolve(ws);
          });
          ws.on("error", (err) => {
            reject(err);
          });
        })
    ),
    Effect.flatMap((ws: WebSocket) =>
      Effect.sync(() => {
        ws.send(JSON.stringify(jsonRpcMessage));
        return ws;
      })
    ),
    Effect.flatMap((ws) =>
      Effect.promise(
        () =>
          new Promise<boolean>((resolve) => {
            ws.on("message", (data) => {
              const resp = JSON.parse(data.toString());
              if (resp.result) {
                resolve(true);
              } else {
                resolve(false);
              }
            });
          })
      )
    )
  ).pipe(
    Effect.timeoutFail({
      onTimeout: () => new Err.JsonRpcRequestTimeout(),
      duration: "5 seconds",
    })
  );

const findPortsByPidEffect = (pid: number, timeout: number = 10000) =>
  Effect.gen(function* (_) {
    const end = Date.now() + timeout;

    for (;;) {
      const command = `lsof -i -n -P | grep LISTEN | grep ${pid} || true`;
      const { stdout } = yield* _(
        Effect.tryPromise(() =>
          execaCommand(command, { shell: true, cleanup: true, timeout: 2000 })
        )
      );
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

      if (Date.now() > end) break;
    }
    return [];
  });
