import { vitestAutoUrl } from "../internal/providerFactories";
import { getEnvironmentFromConfig } from "./configReader";

export async function customDevRpcRequest(method: string, params: any[] = []): Promise<any> {
  const env = getEnvironmentFromConfig();
  const endpoint = env.connections
    ? env.connections[0].endpoints[0].replaceAll("ws://", "http://")
    : vitestAutoUrl().replaceAll("ws://", "http://").replaceAll("wss://", "https://");
  const data = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };

  if (endpoint.startsWith("ws")) {
    console.log("you've passed a websocket to fetch, is this intended?");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });

  const responseData = (await response.json()) as JsonRpcResponse;

  if (responseData.error) {
    throw new Error(responseData.error.message);
  }

  return responseData.result;
}

interface JsonRpcResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}
