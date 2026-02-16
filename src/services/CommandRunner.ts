import { execSync } from "node:child_process";
import { Context, Data, Effect, Layer } from "effect";

export class CommandRunnerError extends Data.TaggedError("CommandRunnerError")<{
  readonly cause: unknown;
  readonly command: string;
  readonly exitCode?: number;
}> {}

export class CommandRunner extends Context.Tag("CommandRunner")<
  CommandRunner,
  {
    readonly exec: (
      command: string,
      options?: { encoding?: BufferEncoding; timeout?: number }
    ) => Effect.Effect<string, CommandRunnerError>;
    readonly execInherit: (command: string) => Effect.Effect<void, CommandRunnerError>;
  }
>() {}

export const CommandRunnerLive = Layer.succeed(CommandRunner, {
  exec: (command, options) =>
    Effect.try({
      try: () =>
        execSync(command, {
          encoding: options?.encoding ?? "utf-8",
          timeout: options?.timeout,
        }) as string,
      catch: (cause: any) =>
        new CommandRunnerError({ cause, command, exitCode: cause?.status ?? undefined }),
    }),
  execInherit: (command) =>
    Effect.try({
      try: () => {
        execSync(command, { stdio: "inherit" });
      },
      catch: (cause: any) =>
        new CommandRunnerError({ cause, command, exitCode: cause?.status ?? undefined }),
    }),
});
