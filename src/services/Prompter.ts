import { select } from "@inquirer/prompts";
import { Context, Effect, Layer } from "effect";
import { UserAbortError } from "./errors.js";

export class Prompter extends Context.Tag("Prompter")<
  Prompter,
  {
    readonly select: <T>(config: {
      message: string;
      choices: ReadonlyArray<{ name: string; value: T }>;
      default?: T;
    }) => Effect.Effect<T, UserAbortError>;
  }
>() {}

export const PrompterLive = Layer.succeed(Prompter, {
  select: (config) =>
    Effect.tryPromise({
      try: () => select(config as Parameters<typeof select>[0]),
      catch: (cause) => new UserAbortError({ cause, context: "prompt" }),
    }) as Effect.Effect<any, UserAbortError>,
});
