import { WsProvider } from "@polkadot/api";
import { setTimeout } from "timers/promises";
import { MoonwallContext } from "./globalContext.js";
import { ProviderType } from "../lib/types.js";

export async function getWsFromConfig(providerName?: string) {
  return providerName
    ? MoonwallContext.getContext()
        .environment.providers.find(({ name }) => name == providerName)
        .ws()
    : MoonwallContext.getContext()
        .environment.providers.find(
          ({ type }) =>
            type == ProviderType.Moonbeam || type == ProviderType.PolkadotJs
        )
        .ws();
}

export async function sendNewBlockRequest(params?: {
  providerName?: string;
  count?: number;
  to?: number;
}) {
  const ws = params
    ? await getWsFromConfig(params.providerName)
    : await getWsFromConfig();

  await ws.connect();
  while (!ws.isConnected) {
    await setTimeout(100);
  }
  if ((params && params.count) || (params && params.to)) {
    await ws.send("dev_newBlock", [{ count: params.count, to: params.to }]);
  } else {
    await ws.send("dev_newBlock", [{ count: 1 }]);
  }
  await ws.disconnect();
}

export async function sendSetStorageRequest(params?: {
  providerName?: string;
  module: string;
  method: string;
  methodParams: any[];
}) {
  const ws = params
    ? await getWsFromConfig(params.providerName)
    : await getWsFromConfig();

  await ws.connect();
  while (!ws.isConnected) {
    await setTimeout(100);
  }

  await ws.send("dev_setStorage", [
    { [params.module]: { [params.method]: params.methodParams } },
  ]);
  await ws.disconnect();
}
