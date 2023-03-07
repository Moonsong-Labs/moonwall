import { setTimeout } from "timers/promises";
import { MoonwallContext } from "./globalContext.js";
import { GenericContext } from "../../types/runner.js";
import { ApiTypes, AugmentedEvent } from "@polkadot/api/types/index.js";
import { ApiPromise } from "@polkadot/api";

export async function getWsFromConfig(providerName?: string) {
  return providerName
    ? MoonwallContext.getContext()
        .environment.providers.find(({ name }) => name == providerName)
        .ws()
    : MoonwallContext.getContext()
        .environment.providers.find(
          ({ type }) => type == "moon" || type == "polkadotJs"
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

export async function chopForkToFinalizedHead(context: MoonwallContext) {
  const api = context.providers.find(
    ({ type }) => type == "moon" || type == "polkadotJs"
  )!.api as ApiPromise;

  const finalizedHead = context.genesis;
  await sendSetHeadRequest(finalizedHead);
  await sendNewBlockRequest();
  while (true) {
    const newHead = (await api.rpc.chain.getFinalizedHead()).toString();
    await setTimeout(50);
    if (newHead !== finalizedHead) {
      context.genesis = newHead;
      break;
    }
  }
}

export async function sendSetHeadRequest(
  newHead: string,
  providerName?: string
) {
  const ws = providerName
    ? await getWsFromConfig(providerName)
    : await getWsFromConfig();

  let result = "";

  await ws.isReady;

  result = await ws.send("dev_setHead", [newHead]);

  await ws.disconnect();
  return result;
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

  while (!ws.isConnected) {
    await setTimeout(100);
  }

  await ws.send("dev_setStorage", [
    { [params!.module]: { [params!.method]: params!.methodParams } },
  ]);
  await ws.disconnect();
}
