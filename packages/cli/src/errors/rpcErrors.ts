export class JsonRpcResponseError {
    readonly _tag = "JsonRpcResponseError";
    constructor(readonly message?: unknown) {}
  }
  

  export class JsonRpcRequestError {
    readonly _tag = "JsonRpcRequestError";
    constructor(readonly message?: unknown) {}
  }
  

  export class JsonRpcRequestTimeout {
    readonly _tag = "JsonRpcRequestTimeout";
  }
  