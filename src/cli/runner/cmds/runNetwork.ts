import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import PressToContinuePrompt from "inquirer-press-to-continue";
import inquirer from "inquirer";
import { MoonwallContext, runNetworkOnly } from "../internal/globalContext.js";
import { importConfig } from "../../../utils/configReader.js";


inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);



const questions = [
  {
    type: "input",
    name: "Quit",
    message: "ℹ️  When you are finished, type 'exit' to quit: \n",
    validate(val) {
      if (val == "exit") {
        return true;
      } else {
        return `🚧  Input ${val} is invalid.\n`;
      }
    },
  },
  {
    name: "NetworkStarted",
    type: "press-to-continue",
    anyKey: true,
    pressToContinueMessage:
      "✅ Network has started. Press any key to continue...\n",
  },
];

export async function runNetwork(args) {
  process.env.TEST_ENV = args.envName;

  try {

    const globalConfig = await importConfig("../../../../moonwall.config.js")
    console.log(globalConfig)


    await runNetworkOnly(globalConfig, process.env.TEST_ENV);

    await inquirer.prompt(questions.find((a) => a.name == "NetworkStarted"));

    await inquirer.prompt(questions.find((a) => a.name == "Quit"));
    MoonwallContext.destroy();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
