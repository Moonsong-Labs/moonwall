import type { ApiPromise } from "@polkadot/api";
import { MoonwallContext } from "../../lib/globalContext.js";
import { jumpRoundsDev, jumpToRoundDev } from "../../../util/index.js";
import { Separator, rawlist, number } from "@inquirer/prompts";
import assert from "node:assert";

export async function resolveDevInteractiveCmdChoice() {
  const ctx = await (await MoonwallContext.getContext()).connectEnvironment();

  const prov = ctx.providers.find((a) => a.type === "polkadotJs");

  if (!prov) {
    throw new Error("Provider not found. This is a bug, please raise an issue.");
  }
  const api = prov.api as ApiPromise;
  const choices: any = [
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
      { name: "🔼  Jump To Round", value: "jumpToRound" },
      { name: "⏫  Jump N Rounds", value: "jumpRounds" }
    );
  }

  choices.push(new Separator(), { name: "🔙  Go Back", value: "back" });

  const choice = await rawlist({
    choices,
    message: "What command would you like to run? ",
  });

  switch (choice) {
    case "createblock":
      try {
        await api.rpc.engine.createBlock(true, true);
      } catch (e) {
        console.error(e);
      }
      break;

    case "createUnfinalizedBlock":
      try {
        await api.rpc.engine.createBlock(true, false);
      } catch (e) {
        console.error(e);
      }
      break;

    case "createNBlocks": {
      try {
        const result = await number({
          message: "How many blocks? ",
        });

        assert(typeof result === "number", "result should be a number");
        assert(result > 0, "result should be greater than 0");

        const executeSequentially = async (remaining: number) => {
          if (remaining === 0) {
            return;
          }
          await api.rpc.engine.createBlock(true, true);
          await executeSequentially(remaining - 1);
        };
        await executeSequentially(result);
      } catch (e) {
        console.error(e);
      }

      break;
    }

    case "jumpToRound": {
      try {
        const round = await number({
          message: "Which round to jump to (in future)? ",
        });

        assert(typeof round === "number", "round should be a number");
        assert(round > 0, "round should be greater than 0");

        await jumpToRoundDev(api, round);
      } catch (e) {
        console.error(e);
      }

      break;
    }

    case "jumpRounds": {
      try {
        const rounds = await number({
          message: "How many rounds? ",
        });

        assert(typeof rounds === "number", "rounds should be a number");
        assert(rounds > 0, "rounds should be greater than 0");

        await jumpRoundsDev(api, rounds);
      } catch (e) {
        console.error(e);
      }

      break;
    }

    case "back":
      break;
  }

  return;
}
