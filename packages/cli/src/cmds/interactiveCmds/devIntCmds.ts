import type { ApiPromise } from "@polkadot/api";
import inquirer from "inquirer";
import { MoonwallContext } from "../../lib/globalContext";
import { jumpRoundsDev, jumpToRoundDev } from "@moonwall/util";

export async function resolveDevInteractiveCmdChoice() {
  const ctx = await (await MoonwallContext.getContext()).connectEnvironment();
  const api = ctx.providers.find((a) => a.type === "polkadotJs")!.api as ApiPromise;
  const choices = [
    { name: "🆗  Create Block", value: "createblock" },
    { name: "🆕  Create Unfinalized Block", value: "createUnfinalizedBlock" },
    { name: "➡️   Create N Blocks", value: "createNBlocks" },
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
      await api.rpc.engine.createBlock(true, true);
      break;

    case "createUnfinalizedBlock":
      await api.rpc.engine.createBlock(true, false);
      break;

    case "createNBlocks": {
      const result = await new inquirer.prompt({
        name: "n",
        type: "number",
        message: `How many blocks? `,
      });

      const executeSequentially = async (remaining: number) => {
        if (remaining === 0) {
          return;
        }
        await api.rpc.engine.createBlock(true, true);
        await executeSequentially(remaining - 1);
      };
      await executeSequentially(result.n);

      break;
    }

    case "jumpToRound": {
      const result = await new inquirer.prompt({
        name: "round",
        type: "number",
        message: `Which round to jump to (in future)? `,
      });

      await jumpToRoundDev(api, result.round);
      break;
    }

    case "jumpRounds": {
      const result = await new inquirer.prompt({
        name: "n",
        type: "number",
        message: `How many rounds? `,
      });

      await jumpRoundsDev(api, result.n);
      break;
    }

    case "back":
      break;
  }

  return;
}
