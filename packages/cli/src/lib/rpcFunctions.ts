import { vitestAutoUrl } from "../internal/providerFactories";
import { getEnvironmentFromConfig } from "./configReader";
import fetch from "node-fetch";

export async function customDevRpcRequest(method: string, params: any[] = []): Promise<any> {
  const env = getEnvironmentFromConfig();
  const endpoint = env.connections
    ? env.connections[0].endpoints[0].replace("ws://", "http://")
    : vitestAutoUrl().replace("ws://", "http://").replace("wss://", "https://");
  const data = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };

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
