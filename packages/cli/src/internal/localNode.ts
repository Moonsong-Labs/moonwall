import { Chunk, Effect, Layer, Option, Stream, StreamEmit } from "effect";
import * as Command from "@effect/platform-node/Command";
import * as CommandExecutor from "@effect/platform-node/CommandExecutor";
import * as FileSystem from "@effect/platform-node/FileSystem";
import * as Path from "@effect/platform-node/Path";
import { execaCommand } from "execa";
import fs from "fs";
import path from "path";
import WebSocket from "ws";
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
        `${path.basename(cmd)}_node_${
          args.find((a) => a.includes("port"))?.split("=")[1]
        }_${new Date().getTime()}.log`
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
          if (yield* _(Effect.sync(() => webSocketProbe(port)))) {
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

const webSocketProbe = (port: number) =>
  Effect.gen(function* (_) {
    const val = yield* _(Stream.runCollect(webSocketStream(port)));
    const filtered = Chunk.toArray(val).filter(
      (val) => val.result !== undefined && val.result.length > 0
    );
    return filtered.length > 0;
  });

const webSocketStream = (port: number) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  return Stream.async((emit: StreamEmit.Emit<never, never, string, void>) => {
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify(jsonRpcMessage));
    });
    ws.addEventListener("message", (e) => {
      emit(Effect.succeed(Chunk.of(e.data.toString())));
      emit(Effect.fail(Option.none()));
    });
    ws.addEventListener("error", (e) => emit(Effect.succeed(Chunk.of(e.message))));
    ws.addEventListener("close", () => emit(Effect.fail(Option.none())));
  }).pipe(
    Stream.map((dataString) => JSON.parse(dataString)),
    Stream.ensuring(Effect.sync(() => ws.close()))
  );
};

const LocalEnvironment = FileSystem.layer.pipe(
  Layer.provideMerge(CommandExecutor.layer),
  Layer.merge(Path.layer)
);

const findPortsByPidEffect = (pid: number, timeout: number = 10000) =>
  Effect.gen(function* (_) {
    const end = Date.now() + timeout;

    for (;;) {
      const command = `lsof -i -n -P | grep LISTEN | grep ${pid} || true`;
      const cmdEffect = Command.make(command).pipe(Command.runInShell("/bin/bash"));

      const output: Effect.Effect<
        CommandExecutor.CommandExecutor | FileSystem.FileSystem | Path.Path,
        unknown,
        readonly string[]
      > = Effect.provide(Command.lines(cmdEffect), LocalEnvironment);

      const lines = yield* _(output);
      const ports: number[] = [];

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

      yield* _(Effect.sleep(100));
    }
    return [];
  });
