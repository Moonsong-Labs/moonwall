import { Command, FileSystem, NodeContext, CommandExecutor, Path } from "@effect/platform-node";
import { Chunk, Effect, Layer, Option, Sink, Stream, StreamEmit } from "effect";
import WebSocket from "ws";
import path from "path";
import nodeFs from "fs";
import { PlatformError } from "@effect/platform-node/Error";

export const launchNode = (cmd: string, args: string[]) =>
  Effect.gen(function* (_) {
    yield* _(Effect.logDebug(`Starting process with command: ${cmd} ${args.join(" ")}`));
    const command = Command.make(cmd, ...args).pipe(
      Command.stdout(collectUint8Array),
      Command.stderr(collectUint8Array),
      Command.start
    );

    const launchedProcess = yield* _(command);

    yield* _(Effect.logDebug(`Started process ${cmd} with pid: ${launchedProcess.pid}`));

    const fs = yield* _(FileSystem.FileSystem);
    const dirPath = path.join(process.cwd(), "tmp", "node_logs");
    if (yield* _(Effect.sync(() => !nodeFs.existsSync(dirPath)))) {
      yield* _(Effect.sync(() => nodeFs.mkdirSync(dirPath, { recursive: true })));
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

    // ** Start logging stderr to file asynchronously
    yield* _(
      launchedProcess.stderr.pipe(
        Stream.runForEach((bytes) => fs.writeFile("./nodeErr.log", bytes)),
        Effect.forkDaemon
      )
    );

    yield* _(Effect.logDebug(`Logging started at ${logLocation}`));

    probe: for (;;) {
      const ports = yield* _(findPortsByPidEffect(launchedProcess.pid));
      yield* _(Effect.logDebug(`Scanning ports ${ports} for process ${launchedProcess.pid}`));
      if (ports) {
        for (const port of ports) {
          if (yield* _(webSocketProbe(port))) {
            yield* _(Effect.logDebug(`Found open websocket on port ${port}`));
            break probe;
          }
        }
      }
    }

    return launchedProcess;
  }).pipe(Effect.provide(NodeContext.layer));

const collectUint8Array: Sink.Sink<never, never, Uint8Array, never, Uint8Array> =
  Sink.foldLeftChunks(new Uint8Array(), (bytes, chunk: Chunk.Chunk<Uint8Array>) =>
    Chunk.reduce(chunk, bytes, (acc, curr) => {
      const newArray = new Uint8Array(acc.length + curr.length);
      newArray.set(acc);
      newArray.set(curr, acc.length);
      return newArray;
    })
  );

const jsonRpcMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "system_chain",
  params: [],
};

const webSocketProbe = (port: number) =>
  Effect.gen(function* (_) {
    yield* _(Effect.logDebug(`Scanning port: ${port}`));
    const val = yield* _(Stream.runCollect(webSocketStream(port)));
    const filtered = Chunk.toArray(val).filter(
      (val) => val.result !== undefined && val.result.length > 0
    );
    yield* _(Effect.logDebug(`Websocket probe result: ${JSON.stringify(Chunk.toArray(val))}`));
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
    ws.addEventListener("error", () => {
      return emit(Effect.fail(Option.none()));
    });
    ws.addEventListener("close", () => {
      return emit(Effect.fail(Option.none()));
    });
  }).pipe(
    Stream.map((dataString) => JSON.parse(dataString)),
    Stream.ensuring(Effect.sync(() => ws.close()))
  );
};

const findPortsByPidEffect = (pid: number, timeout: number = 10000) =>
  Effect.gen(function* (_) {
    const end = Date.now() + timeout;

    for (;;) {
      const command = `lsof -i -n -P | grep LISTEN | grep ${pid} || true`;
      const cmdEffect = Command.make(command).pipe(Command.runInShell("/bin/bash"));

      const output: Effect.Effect<
        CommandExecutor.CommandExecutor | FileSystem.FileSystem | Path.Path,
        PlatformError,
        readonly string[]
      > = Effect.provide(
        Command.lines(cmdEffect),
        FileSystem.layer.pipe(Layer.provideMerge(CommandExecutor.layer), Layer.merge(Path.layer))
      );

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
