import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import PressToContinuePrompt from 'inquirer-press-to-continue';
import type { KeyDescriptor } from 'inquirer-press-to-continue';
import inquirer from "inquirer";
import { MoonwallContext, runNetworkOnly } from "../internal/globalContext.js";
import { globalConfig } from "../../../../moonwall.config.js";


inquirer.registerPrompt('press-to-continue', PressToContinuePrompt);

// const { key: enterKey } = await inquirer.prompt<{ key: KeyDescriptor }>({
//   name: 'key',
//   type: 'press-to-continue',
//   enter: true,
// });

const questions = [
  {
    type: "input",
    name: "Quit",
    message: "ℹ️  When you are finished, type 'exit' to quit: \n",
    validate(val){
      if (val == "exit"){
        return true
      } else {
       return `🚧  Input ${val} is invalid.\n`
      }
  }
  },
  {
    name: 'NetworkStarted',
    type: 'press-to-continue',
    anyKey: true,
    pressToContinueMessage: '✅ Network has started. Press any key to continue...\n',
  },
];


export async function runNetwork(args) {
  process.env.TEST_ENV = args.envName;

  try {
    await runNetworkOnly(globalConfig,process.env.TEST_ENV);

    await inquirer.prompt(questions.find(a=>a.name=="NetworkStarted"));


    await inquirer.prompt(questions.find(a=>a.name=="Quit"));
    MoonwallContext.destroy();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

