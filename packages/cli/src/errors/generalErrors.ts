export class TestsFailedError {
  readonly _tag = "TestsFailedError";
  constructor(readonly fails?: number) {}
}

export class CommonCheckError {
  readonly _tag = "CommonCheckError";
}

export class RunNetworkError {
  readonly _tag = "RunNetworkError";
}
