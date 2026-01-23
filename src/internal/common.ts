export function normalizeUrlToHttps(url: string): string {
  return url.replace(/^ws(s)?:/, "http$1:");
}

export async function directRpcRequest(
  endpoint: string,
  method: string,
  params: any[] = [],
  timeoutMs: number = 10000 // Default 10 second timeout
): Promise<any> {
  const data = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };

  if (endpoint.startsWith("ws")) {
    console.log("you've passed a websocket to fetch, is this intended?");
  }

  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseData = (await response.json()) as JsonRpcResponse;

    if (responseData.error) {
      throw new Error(responseData.error.message);
    }

    return responseData.result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(
        `RPC request to ${endpoint} timed out after ${timeoutMs}ms (method: ${method})`,
        { cause: error }
      );
    }
    throw new Error(`RPC request to ${endpoint} failed (method: ${method}): ${error.message}`, {
      cause: error,
    });
  }
}

interface JsonRpcResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}
