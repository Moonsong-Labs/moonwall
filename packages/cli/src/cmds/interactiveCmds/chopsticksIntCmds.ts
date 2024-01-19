import { promises as fsPromises } from "fs";
import inquirer from "inquirer";
import { parse } from "yaml";
import { importJsonConfig } from "../../lib/configReader";
import { MoonwallContext } from "../../lib/globalContext";
import type { ApiPromise } from "@polkadot/api";
import { jumpBlocksChopsticks, jumpRoundsChopsticks, jumpToRoundChopsticks } from "@moonwall/util";

export async function resolveChopsticksInteractiveCmdChoice() {
  const globalConfig = importJsonConfig();
  const config = globalConfig.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;

  if (config.foundation.type !== "chopsticks") {
    throw new Error("Only chopsticks is supported, this is a bug please raise an issue.");
  }

  const isMultiChain = config.foundation.launchSpec.length > 1;

  const promptNode = async () => {
    if (config.foundation.type !== "chopsticks") {
      throw new Error("Only chopsticks is supported, this is a bug please raise an issue.");
    }
    const nodes = config.foundation.launchSpec.map(({ name }) => name);

    const result = await inquirer.prompt({
      name: "name",
      type: "list",
      choices: nodes,
      message: `Which network would you like to interact with? `,
    });

    return result.name;
  };

  const nodeSelected = isMultiChain ? await promptNode() : config.foundation.launchSpec[0].name;

  const ctx = await (await MoonwallContext.getContext()).connectEnvironment();
  const provider = ctx.providers.find((a) => a.type == "polkadotJs" && a.name == nodeSelected);

  if (!provider) {
    throw new Error(
      `Provider ${nodeSelected} not found. Verify moonwall config has matching pair of launchSpec and Connection names.`
    );
  }

  const api = provider.api as ApiPromise;

  const ports = await Promise.all(
    config.foundation.launchSpec
      .filter(({ name }) => name == nodeSelected)
      .map(async ({ configPath }) => {
        const yaml = parse((await fsPromises.readFile(configPath)).toString());
        return (yaml.port as string) || "8000";
      })
  );
  const port = parseInt(ports[0]);

  const choices = [
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

  choices.push(...[new inquirer.Separator(), { name: "🔙  Go Back", value: "back" }]);

  const choice = await inquirer.prompt({
    name: "cmd",
    type: "list",
    choices,
    message: `What command would you like to run? `,
    default: "createBlock",
  });

  switch (choice.cmd) {
    case "createblock":
      await jumpBlocksChopsticks(port, 1);
      break;

    case "createNBlocks": {
      const result = await new inquirer.prompt({
        name: "n",
        type: "number",
        message: `How many blocks? `,
      });

      await jumpBlocksChopsticks(port, result.n);

      break;
    }

    case "jumpToRound": {
      const result = await new inquirer.prompt({
        name: "round",
        type: "number",
        message: `Which round to jump to (in future)? `,
      });
      console.log("💤 This may take a while....");
      await jumpToRoundChopsticks(api, port, result.round);
      break;
    }

    case "jumpRounds": {
      const result = await new inquirer.prompt({
        name: "n",
        type: "number",
        message: `How many rounds? `,
      });
      console.log("💤 This may take a while....");
      await jumpRoundsChopsticks(api, port, result.n);
      break;
    }

    case "back":
      break;
  }

  return;
}
