import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import PressToContinuePrompt from "inquirer-press-to-continue";
import inquirer from "inquirer";
import { MoonwallContext, runNetworkOnly } from "../internal/globalContext.js";
import { importConfig } from "../../../utils/configReader.js";
import clear from "clear";
import chalk from "chalk";
import { Environment } from "../../../types/config.js";
import { executeTests } from "./runTests.js";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

export async function runNetwork(args) {
  process.env.TEST_ENV = args.envName;
  const globalConfig = await importConfig("../../moonwall.config.js");

  const questions = [
    {
      type: "confirm",
      name: "Quit",
      message: "ℹ️  Are you sure you'd like to close network and quit? \n",
      default: false,
    },
    {
      name: "Choice",
      type: "list",
      message: "What would you like todo now",
      choices: ["Chill", "Info", "Test", "Quit"],
    },
    {
      name: "MenuChoice",
      type: "list",
      message:
        `Environment : ${chalk.bgGray.cyanBright(args.envName)}\n` +
        "Please select a choice: ",
      default: 0,
      pageSize: 10,
      choices: [
        {
          name: chalk.dim("1) Chill:   🏗️  Not Yet Implemented"),
          value: 0,
          disabled: true,
          short: "chill",
        },
        {
          name: `2) Info:      Display Information about this environment ${args.envName}`,
          value: 1,
          short: "info",
        },
        {
          name:
            "3) Test:      Execute tests registered for this environment   (" +
            chalk.bgGrey.cyanBright(
              globalConfig.environments.find(({ name }) => name == args.envName)
                .testFileDir
            ) +
            ")",
          value: 2,
          short: "test",
        },
        {
          name: "4) Quit:      Close network and quit the application",
          value: 3,
          short: "quit",
        },
      ],
      filter(val) {
        return val;
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

  try {
    await runNetworkOnly(globalConfig);
    clear();
    await inquirer.prompt(
      questions.find(({ name }) => name == "NetworkStarted")
    );

    mainloop: while (true) {
      const choice = await inquirer.prompt(
        questions.find(({ name }) => name == "MenuChoice")
      );
      const env = globalConfig.environments.find(
        ({ name }) => name === args.envName
      );

      switch (choice.MenuChoice) {
        case 0:
          console.log("I'm chilling");
          break;

        case 1:
          resolveInfoChoice(env);
          break;

        case 2:
          await resolveTestChoice(env);
          break;

        case 3:
          const quit = await inquirer.prompt(
            questions.find(({ name }) => name == "Quit")
          );
          if (quit.Quit === true) {
            break mainloop;
          }
          break;
        default:
          throw new Error("invalid value");
      }
    }

    MoonwallContext.destroy();
    console.log(`Goodbye! 👋`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

const resolveInfoChoice = async (env) => {
  console.dir(env, { depth: null });
};

const resolveTestChoice = async (env: Environment) => {
  return await executeTests(env);
};
