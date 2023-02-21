import { WsProvider } from "@polkadot/api";
import { setTimeout } from "timers/promises";
import { MoonwallContext } from "./globalContext.js";
import { ProviderType } from "../../../types/enum.js";
import { GenericContext } from "../../../types/runner.js";
import { ApiTypes, AugmentedEvent } from "@polkadot/api/types/index.js";

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

export async function sendNewBlockAndCheck(
  context: GenericContext,
  expectedEvents: AugmentedEvent<ApiTypes>[]
) {
  const newBlock = await sendNewBlockRequest();
  const api = context.getSubstrateApi();
  const apiAt = await api.at(newBlock);

  const actualEvents = await apiAt.query.system.events();
  const match = expectedEvents.every((eEvt) => {
    return actualEvents
      .map((aEvt) => {
        if (
          api.events.system.ExtrinsicSuccess.is(aEvt.event) &&
          (aEvt.event.data as any).dispatchInfo.class.toString() !== "Normal"
        ) {
          return false;
        }
        return eEvt.is(aEvt.event);
      })
      .reduce((acc, curr) => acc || curr, false);
  });
  return { match, events: actualEvents };
}

export async function sendNewBlockRequest(params?: {
  providerName?: string;
  count?: number;
  to?: number;
}) {
  const ws = params
    ? await getWsFromConfig(params.providerName)
    : await getWsFromConfig();

  let result = "";

  await ws.connect();
  while (!ws.isConnected) {
    await setTimeout(100);
  }
  if ((params && params.count) || (params && params.to)) {
    result = await ws.send("dev_newBlock", [
      { count: params.count, to: params.to },
    ]);
  } else {
    result = await ws.send("dev_newBlock", [{ count: 1 }]);
  }
  await ws.disconnect();
  return result;
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
