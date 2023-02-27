import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import PressToContinuePrompt from "inquirer-press-to-continue";
import inquirer from "inquirer";
import { MoonwallContext, runNetworkOnly } from "../internal/globalContext.js";
import { importConfig } from "../../utils/configReader.js";
import clear from "clear";
import chalk from "chalk";
import { Environment } from "../../types/config.js";
import { executeTests } from "./runTests.js";
import { parse } from "yaml";
import fs from "fs/promises";
import { Foundation } from "../../types/enum.js";
import { globalConfig } from "../../../moonwall.config.js";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

export async function runNetwork(args) {
  process.env.TEST_ENV = args.envName;
  const globalConfig = await importConfig("../../moonwall.config.js");
  const testFileDirs = globalConfig.environments.find(
    ({ name }) => name == args.envName
  )!.testFileDir;

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
          name: `Info:      Display Information about this environment ${args.envName}`,
          value: 2,
          short: "info",
        },
        {
          name:
            testFileDirs.length > 0
              ? "Test:      Execute tests registered for this environment   (" +
                chalk.bgGrey.cyanBright(testFileDirs) +
                ")"
              : chalk.dim("Test:    NO TESTS SPECIFIED"),
          value: 3,
          disabled: testFileDirs.length > 0 ? false : true,
          short: "test",
        },
        {
          name: "Quit:      Close network and quit the application",
          value: 4,
          short: "quit",
        },
        new inquirer.Separator(),
        {
          name: chalk.dim("Chill:   🏗️  Not Yet Implemented"),
          value: 1,
          disabled: true,
          short: "chill",
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
      pressToContinueMessage: "✅  Press any key to continue...\n",
    },
  ];

  try {
    await runNetworkOnly(globalConfig);
    clear();
    const portsList = await reportServicePorts();

    portsList.forEach((ports) =>
      console.log(
        `  🖥️   https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A${ports.wsPort}`
      )
    );

    await inquirer.prompt(
      questions.find(({ name }) => name == "NetworkStarted")
    );

    mainloop: while (true) {
      const choice = await inquirer.prompt(
        questions.find(({ name }) => name == "MenuChoice")
      );
      const env = globalConfig.environments.find(
        ({ name }) => name === args.envName
      )!;

      switch (choice.MenuChoice) {
        case 1:
          /// TODO: Add ability to listen to logs of started node (dev or chopsticks)
          console.log("I'm chilling");
          break;

        case 2:
          resolveInfoChoice(env);
          await reportServicePorts();
          break;

        case 3:
          await resolveTestChoice(env);
          break;

        case 4:
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

const reportServicePorts = async () => {
  const ctx = MoonwallContext.getContext();
  const portsList: {
    wsPort: string;
    httpPort: string;
  }[] = [];
  const config = globalConfig.environments.find(
    ({ name }) => name == process.env.TEST_ENV
  )!;
  if (config.foundation.type == Foundation.Dev) {
    const ports = { wsPort: "", httpPort: "" };
    ports.wsPort =
      ctx.environment.nodes[0].args
        .find((a) => a.includes("ws-port"))!
        .split("=")[1] || "9944";
    ports.httpPort =
      ctx.environment.nodes[0].args
        .find((a) => a.includes("rpc-port"))!
        .split("=")[1] || "9933";

    portsList.push(ports);
  } else if (config.foundation.type == Foundation.Chopsticks) {
    portsList.push(
      ...(await Promise.all(
        config.foundation.launchSpec.map(async ({ configPath }) => {
          const yaml = parse((await fs.readFile(configPath)).toString());
          return {
            wsPort: yaml.port || "8000",
            httpPort: "<🏗️  NOT YET IMPLEMENTED>",
          };
        })
      ))
    );
  }
  portsList.forEach((ports) =>
    console.log(
      `  🌐  Node has started, listening on ports - Websocket: ${ports.wsPort} and HTTP: ${ports.httpPort}`
    )
  );

  return portsList;
};

const resolveInfoChoice = async (env: Environment) => {
  console.log(chalk.bgWhite.blackBright("Node Launch args:"));
  console.dir(MoonwallContext.getContext().environment, { depth: null });
  console.log(chalk.bgWhite.blackBright("Launch Spec in Config File:"));
  console.dir(env, { depth: null });
};

const resolveTestChoice = async (env: Environment) => {
  return await executeTests(env);
};
