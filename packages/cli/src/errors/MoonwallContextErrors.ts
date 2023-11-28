import { Data } from "effect";

// export class MoonwallContextDestroyError {
//   readonly _tag = "MoonwallContextDestroyError";
// }

export class MoonwallContextCreateError {
  readonly _tag = "MoonwallContextCreateError";
}

export class MoonwallContextDestroyError extends Data.TaggedError(
  "MoonwallContextDestroyError"
)<object> {}

export class MoonwallContextNetworkError extends Data.TaggedError(
  "MoonwallContextNetworkError"
)<object> {}
