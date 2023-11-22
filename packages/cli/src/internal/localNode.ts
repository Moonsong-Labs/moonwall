import { Effect } from "effect";
import { execaCommand } from "execa";
import fs from "fs";
import path from "path";
import WebSocket from "ws";
import * as Err from "../errors";
import { checkAccess, checkExists } from "./fileCheckers";

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
          if (yield* _(webSocketProbe(port))) {
            break probe;
          }
        }
      }
    }
    return { pid: runningNode.pid, kill: runningNode.kill } satisfies LaunchedNode;
  });

const jsonRpcMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "system_chain",
  params: [],
};

// 1 Acquire resource
// 2 Use resource
// 3 Release resource

interface WebSocketProbe {
  readonly ws: WebSocket;
  readonly close: () => Promise<void>;
}

const webSocketProbe = (port: number) => {
  const getWebsocketProbe = (port: number): Promise<WebSocketProbe> =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`) as WebSocket;
      ws.on("open", () =>
        resolve({
          ws,
          close: () =>
            new Promise((resolve) => {
              ws.close();
              resolve();
            }),
        })
      );

      ws.on("error", () => reject());
    });

  const acquire = Effect.tryPromise({
    try: () => getWebsocketProbe(port),
    catch: () => new Err.JsonRpcCannotOpen(),
  });

  const release = (res: WebSocketProbe) => Effect.promise(() => res.close());

  const use = (res: WebSocketProbe) =>
    Effect.all([
      Effect.promise(
        () =>
          new Promise<void>((resolve) => {
            res.ws.send(JSON.stringify(jsonRpcMessage));
            resolve();
          })
      ),
      Effect.promise(
        () =>
          new Promise<boolean>((resolve) => {
            res.ws.on("message", (data) => {
              const resp = JSON.parse(data.toString());
              if (resp.result) {
                resolve(true);
              } else {
                resolve(false);
              }
            });
          })
      ),
    ]).pipe(
      Effect.timeoutFail({
        onTimeout: () => new Err.JsonRpcRequestTimeout(),
        duration: "5 seconds",
      })
    );

  return Effect.acquireUseRelease(acquire, use, release).pipe(
    Effect.catchTag("JsonRpcCannotOpen", () => Effect.succeed(false))
  );
};

const findPortsByPidEffect = (pid: number, timeout: number = 10000) =>
  Effect.gen(function* (_) {
    const end = yield* _(Effect.sync(() => Date.now() + timeout));

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
