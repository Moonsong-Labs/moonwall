export class EnvironmentMissingError {
  readonly _tag = "EnvironmentMissingError";
  constructor(readonly env: string) {}
}

export class ConfigError {
  readonly _tag = "ConfigError";
  constructor(readonly customMessage?: string) {}
}

export class MoonwallContextError {
  readonly _tag = "MoonwallContextError";
}
