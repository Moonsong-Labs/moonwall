import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import inquirer from "inquirer"
import { MoonwallContext, runNetworkOnly } from "../internal/globalContext.js";
import { globalConfig } from "../../../../moonwall.config.js";

export async function runNetwork(args) {
  try {
    await runNetworkOnly(globalConfig, args.envName);

  await inquirer.prompt(questions)
    MoonwallContext.destroy();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}


const questions = [
  {
    type: "input",
    name: "quit",
    message: "✅ Network has started. Type 'exit' to quit: "
  }
]