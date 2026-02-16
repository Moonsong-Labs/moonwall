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
    /** Run a shell command and return stdout. Runs via shell, so pipes and redirects work. */
    readonly exec: (
      command: string,
      options?: { timeout?: number }
    ) => Effect.Effect<string, CommandRunnerError>;
    /** Run a shell command with inherited stdio (output goes to terminal). */
    readonly execInherit: (command: string) => Effect.Effect<void, CommandRunnerError>;
  }
>() {}

export const CommandRunnerLive = Layer.succeed(CommandRunner, {
  exec: (command, options) =>
    Effect.try({
      try: () =>
        execSync(command, {
          encoding: "utf-8",
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
