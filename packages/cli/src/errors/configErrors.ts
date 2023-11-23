import { Data } from "effect";

export class EnvironmentMissingError extends Data.TaggedError("EnvironmentMissingError")<{
  env: string;
}> {}

export class ConfigError {
  readonly _tag = "ConfigError";
  constructor(readonly customMessage?: string) {}
}

export class MoonwallContextError {
  readonly _tag = "MoonwallContextError";
}
