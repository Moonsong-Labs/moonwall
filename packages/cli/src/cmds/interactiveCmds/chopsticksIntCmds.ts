import { promises as fsPromises } from "node:fs";
import { parse } from "yaml";
import { getEnvironmentFromConfig } from "../../lib/configReader";
import { MoonwallContext } from "../../lib/globalContext";
import type { ApiPromise } from "@polkadot/api";
import { jumpBlocksChopsticks, jumpRoundsChopsticks, jumpToRoundChopsticks } from "@moonwall/util";
import { number, select, Separator } from "@inquirer/prompts";
import assert from "node:assert";

type Choice<Value> = {
  value: Value;
  name?: string;
  description?: string;
  short?: string;
  disabled?: boolean | string;
};

export async function resolveChopsticksInteractiveCmdChoice() {
  const config = getEnvironmentFromConfig();

  if (config.foundation.type !== "chopsticks") {
    throw new Error("Only chopsticks is supported, this is a bug please raise an issue.");
  }

  const isMultiChain = config.foundation.launchSpec.length > 1;

  const promptNode = async () => {
    if (config.foundation.type !== "chopsticks") {
      throw new Error("Only chopsticks is supported, this is a bug please raise an issue.");
    }
    const nodes = config.foundation.launchSpec.map(({ name }) => name);

    const name = await select({
      choices: nodes,
      message: "Which network would you like to interact with? ",
    });

    return name;
  };

  const nodeSelected = isMultiChain ? await promptNode() : config.foundation.launchSpec[0].name;

  const ctx = await (await MoonwallContext.getContext()).connectEnvironment();
  const provider = ctx.providers.find((a) => a.type === "polkadotJs" && a.name === nodeSelected);

  if (!provider) {
    throw new Error(
      `Provider ${nodeSelected} not found. Verify moonwall config has matching pair of launchSpec and Connection names.`
    );
  }

  const api = provider.api as ApiPromise;

  const ports = await Promise.all(
    config.foundation.launchSpec
      .filter(({ name }) => name === nodeSelected)
      .map(async ({ configPath }) => {
        const yaml = parse((await fsPromises.readFile(configPath)).toString());
        return (yaml.port as string) || "8000";
      })
  );
  const port = Number.parseInt(ports[0], 10);

  const choices: (string | Separator)[] | (Separator | Choice<unknown>)[] = [
    { name: "🆗  Create Block", value: "createblock" },
    { name: "➡️  Create N Blocks", value: "createNBlocks" },
  ];

  const containsPallet = (polkadotJsApi: ApiPromise, palletName: string): boolean => {
    const metadata = polkadotJsApi.runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === palletName
    );

    return systemPalletIndex !== -1;
  };

  if (containsPallet(api, "ParachainStaking")) {
    choices.push(
      ...[
        { name: "🔼  Jump To Round", value: "jumpToRound" },
        { name: "⏫  Jump N Rounds", value: "jumpRounds" },
      ]
    );
  }

  choices.push(...[new Separator(), { name: "🔙  Go Back", value: "back" }]);

  const cmd = await select({
    choices,
    message: "What command would you like to run? ",
    default: "createBlock",
  });

  switch (cmd) {
    case "createblock":
      try {
        await jumpBlocksChopsticks(port, 1);
      } catch (e: any) {
        console.error(e.message);
      }
      break;

    case "createNBlocks": {
      try {
        const nBlocks = await number({
          message: "How many blocks? ",
        });

        assert(typeof nBlocks === "number", "Number must be a number");

        assert(nBlocks > 0, "Number must be greater than 0");

        await jumpBlocksChopsticks(port, nBlocks);
      } catch (e: any) {
        console.error(e.message);
      }
      break;
    }

    case "jumpToRound": {
      try {
        const round = await number({
          message: "Which round to jump to (in future)? ",
        });
        assert(typeof round === "number", "Number must be a number");

        assert(round > 0, "Number must be greater than 0");
        console.log("💤 This may take a while....");

        await jumpToRoundChopsticks(api, port, round);
      } catch (e: any) {
        console.error(e.message);
      }

      break;
    }

    case "jumpRounds": {
      try {
        const rounds = await number({
          message: "How many rounds? ",
        });
        assert(typeof rounds === "number", "Number must be a number");

        assert(rounds > 0, "Number must be greater than 0");

        console.log("💤 This may take a while....");
        await jumpRoundsChopsticks(api, port, rounds);
      } catch (e: any) {
        console.error(e.message);
      }

      break;
    }

    case "back":
      break;
  }

  return;
}
