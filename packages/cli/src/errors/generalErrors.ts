import { Data } from "effect";

export class TestsFailedError extends Data.TaggedError("TestsFailedError")<{ fails?: number }> {}

export class CommonCheckError {
  readonly _tag = "CommonCheckError";
}

export class RunNetworkError {
  readonly _tag = "RunNetworkError";
}

export class InvalidCommandError extends Data.TaggedError("InvalidCommand")<{ command: string }> {}
