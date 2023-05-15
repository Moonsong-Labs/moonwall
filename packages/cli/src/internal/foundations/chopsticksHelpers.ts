import { setTimeout } from "timers/promises";
import { MoonwallContext } from "../../lib/globalContext.js";
import { GenericContext } from "../../types/runner.js";
import { ApiTypes, AugmentedEvent } from "@polkadot/api/types/index.js";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { FrameSystemEventRecord } from "@polkadot/types/lookup";
import { ChopsticksBlockCreation } from "../../lib/contextHelpers.js";
import chalk from "chalk";
import { assert } from "vitest";

export async function getWsFromConfig(providerName?: string): Promise<WsProvider> {
  if (providerName) {
    const provider = MoonwallContext.getContext().environment.providers.find(
      ({ name }) => name == providerName
    );

    if (typeof provider == "undefined") {
      throw new Error(`Cannot find provider ${chalk.bgWhiteBright.blackBright(providerName)}`);
    }

    if (!!!provider.ws) {
      throw new Error("Provider does not have an attached ws() property ");
    }

    return provider.ws();
  } else {
    const provider = MoonwallContext.getContext().environment.providers.find(
      ({ type }) => type == "moon" || type == "polkadotJs"
    );

    if (typeof provider == "undefined") {
      throw new Error(
        `Cannot find providers of type ${chalk.bgWhiteBright.blackBright(
          "moon"
        )} or ${chalk.bgWhiteBright.blackBright("polkadotJs")}`
      );
    }

    if (!!!provider.ws) {
      throw new Error("Provider does not have an attached ws() property ");
    }

    return provider.ws();
  }
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

export async function createChopsticksBlock(
  context: GenericContext,
  options: ChopsticksBlockCreation = { allowFailures: false }
) {
  const result = await sendNewBlockRequest(options);
  const apiAt = await context.polkadotJs().at(result);
  const actualEvents = await apiAt.query.system.events();

  if (options && options.expectEvents) {
    const match = options.expectEvents.every((eEvt) => {
      const found = actualEvents
        .map((aEvt) => eEvt.is(aEvt.event))
        .reduce((acc, curr) => acc || curr, false);
      if (!found) {
        options.logger
          ? options.logger(
              `Event ${chalk.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            )
          : console.error(
              `Event ${chalk.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            );
      }
      return found;
    });
    assert(match, "Expected events not present in block");
  }

  if (options && options.allowFailures === true) {
    // Skip ExtrinsicFailure Asserts
  } else {
    actualEvents.forEach((event) => {
      assert(
        !context.polkadotJs().events.system.ExtrinsicFailed.is(event.event),
        "ExtrinsicFailed event detected, enable 'allowFailures' if this is expected."
      );
    });
  }
  return { result };
}

export async function chopForkToFinalizedHead(context: MoonwallContext) {
  const api = context.providers.find(({ type }) => type == "moon" || type == "polkadotJs")!
    .api as ApiPromise;

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
  if ((params && params.count) || (params && params.to)) {
    result = await ws.send("dev_newBlock", [{ count: params.count, to: params.to }]);
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
  const ws = params ? await getWsFromConfig(params.providerName) : await getWsFromConfig();

  while (!ws.isConnected) {
    await setTimeout(100);
  }

  await ws.send("dev_setStorage", [
    { [params!.module]: { [params!.method]: params!.methodParams } },
  ]);
  await ws.disconnect();
}
