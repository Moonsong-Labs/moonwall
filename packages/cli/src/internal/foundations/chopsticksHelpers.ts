import "@moonbeam-network/api-augment";
import type { ChopsticksBlockCreation, GenericContext } from "@moonwall/types";
import type { WsProvider } from "@polkadot/api";
import type { ApiTypes, AugmentedEvent } from "@polkadot/api/types";
import type { FrameSystemEventRecord } from "@polkadot/types/lookup";
import chalk from "chalk";
import { setTimeout } from "node:timers/promises";
import { MoonwallContext } from "../../lib/globalContext";

export async function getWsFromConfig(providerName?: string): Promise<WsProvider> {
  if (providerName) {
    const provider = (await MoonwallContext.getContext()).environment.providers.find(
      ({ name }) => name === providerName
    );

    if (typeof provider === "undefined") {
      throw new Error(`Cannot find provider ${chalk.bgWhiteBright.blackBright(providerName)}`);
    }

    if (!provider.ws) {
      throw new Error("Provider does not have an attached ws() property ");
    }

    return provider.ws();
  }
  const provider = (await MoonwallContext.getContext()).environment.providers.find(
    ({ type }) => type === "polkadotJs"
  );

  if (typeof provider === "undefined") {
    throw new Error(
      `Cannot find providers of type ${chalk.bgWhiteBright.blackBright("polkadotJs")}`
    );
  }

  if (!provider.ws) {
    throw new Error("Provider does not have an attached ws() property ");
  }

  return provider.ws();
}

export async function sendNewBlockAndCheck(
  context: GenericContext,
  expectedEvents: AugmentedEvent<ApiTypes>[]
): Promise<{
  match: boolean;
  events: FrameSystemEventRecord[];
}> {
  const newBlock = await sendNewBlockRequest();
  const api = context.polkadotJs();
  const apiAt = await api.at(newBlock);

  const actualEvents: any = await apiAt.query.system.events();
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

export async function createChopsticksBlock(
  context: GenericContext,
  options: ChopsticksBlockCreation = { allowFailures: false }
) {
  const result = await sendNewBlockRequest(options);
  const apiAt = await context.polkadotJs(options.providerName).at(result);
  const actualEvents: any = await apiAt.query.system.events();

  if (options?.expectEvents) {
    const match = options.expectEvents.every((eEvt) => {
      const found = actualEvents
        .map((aEvt) => eEvt.is(aEvt.event))
        .reduce((acc, curr) => acc || curr, false);
      if (!found) {
        options.logger
          ? options.logger.error(
              `Event ${chalk.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            )
          : console.error(
              `Event ${chalk.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            );
      }
      return found;
    });

    if (!match) {
      throw new Error("Expected events not present in block");
    }
  }

  if (options && options.allowFailures === true) {
    // Skip ExtrinsicFailure Asserts
  } else {
    for (const event of actualEvents) {
      if (context.polkadotJs().events.system.ExtrinsicFailed.is(event.event)) {
        throw new Error(
          `ExtrinsicFailed event detected, enable 'allowFailures' if this is expected.`
        );
      }
    }
  }
  return { result };
}

export async function sendSetHeadRequest(newHead: string, providerName?: string) {
  const ws = providerName ? await getWsFromConfig(providerName) : await getWsFromConfig();

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
  const ws = params ? await getWsFromConfig(params.providerName) : await getWsFromConfig();

  let result = "";

  while (!ws.isConnected) {
    await setTimeout(100);
  }
  if (params?.count || params?.to) {
    result = await ws.send("dev_newBlock", [{ count: params.count, to: params.to }]);
  } else {
    result = await ws.send("dev_newBlock", [{ count: 1 }]);
  }
  await ws.disconnect();
  return result;
}

export async function sendSetStorageRequest(params: {
  providerName?: string;
  module: string;
  method: string;
  methodParams: any[];
}) {
  const ws = params ? await getWsFromConfig(params.providerName) : await getWsFromConfig();

  while (!ws.isConnected) {
    await setTimeout(100);
  }

  await ws.send("dev_setStorage", [{ [params.module]: { [params.method]: params.methodParams } }]);
  await ws.disconnect();
}
