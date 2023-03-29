import PressToContinuePrompt from "inquirer-press-to-continue";
import { setTimeout } from "timers/promises";
import inquirer from "inquirer";
import { MoonwallContext, runNetworkOnly } from "../lib/globalContext.js";
import clear from "clear";
import chalk from "chalk";
import { Environment } from "../types/config.js";
import { executeTests } from "./runTests.js";
import { parse } from "yaml";
import fs from "fs/promises";
import { importJsonConfig } from "../lib/configReader.js";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

export async function runNetwork(args) {
  process.env.MOON_TEST_ENV = args.envName;
  const globalConfig = await importJsonConfig();
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
        `Environment : ${chalk.bgGray.cyanBright(args.envName)}\n` + "Please select a choice: ",
      default: 0,
      pageSize: 10,
      choices: [
        {
          name: "Tail:      Print the logs of the current running node to this console",
          value: 1,
          short: "tail",
        },
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
          name:
            testFileDirs.length > 0
              ? "GrepTest:  Execute individual test(s) based on grepping the name / ID (" +
                chalk.bgGrey.cyanBright(testFileDirs) +
                ")"
              : chalk.dim("Test:    NO TESTS SPECIFIED"),
          value: 4,
          disabled: testFileDirs.length > 0 ? false : true,
          short: "test",
        },
        {
          name: "Quit:      Close network and quit the application",
          value: 5,
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
      pressToContinueMessage: "✅  Press any key to continue...\n",
    },
  ];

  await runNetworkOnly(globalConfig);
  clear();
  const portsList = await reportServicePorts();

  portsList.forEach((ports) =>
    console.log(`  🖥️   https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A${ports.wsPort}`)
  );

  await inquirer.prompt(questions.find(({ name }) => name == "NetworkStarted"));

  mainloop: while (true) {
    const choice = await inquirer.prompt(questions.find(({ name }) => name == "MenuChoice"));
    const env = globalConfig.environments.find(({ name }) => name === args.envName)!;

    switch (choice.MenuChoice) {
      case 1:
        clear();
        await resolveTailChoice();
        clear();
        break;

      case 2:
        resolveInfoChoice(env);
        await reportServicePorts();
        break;

      case 3:
        await resolveTestChoice(env);
        break;

      case 4:
        await resolveGrepChoice(env);

      case 5:
        const quit = await inquirer.prompt(questions.find(({ name }) => name == "Quit"));
        if (quit.Quit === true) {
          break mainloop;
        }
        break;
      default:
        throw new Error("invalid value");
    }
  }

  await MoonwallContext.destroy();
  console.log(`Goodbye! 👋`);
  process.exit(0);
}

const reportServicePorts = async () => {
  const ctx = MoonwallContext.getContext();
  const portsList: {
    wsPort: string;
    httpPort: string;
  }[] = [];
  const globalConfig = await importJsonConfig();
  const config = globalConfig.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
  if (config.foundation.type == "dev") {
    const ports = { wsPort: "", httpPort: "" };
    ports.wsPort =
      ctx.environment.nodes[0].args.find((a) => a.includes("ws-port"))!.split("=")[1] || "9944";
    ports.httpPort =
      ctx.environment.nodes[0].args.find((a) => a.includes("rpc-port"))!.split("=")[1] || "9933";

    portsList.push(ports);
  } else if (config.foundation.type == "chopsticks") {
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

const resolveGrepChoice = async (env: Environment) => {
  const choice = await inquirer.prompt({
    name: "grep",
    type: "input",
    message: `What pattern would you like to filter for (ID/Title): `,
    default: "D01T01",
  });
  return await executeTests(env, { testNamePattern: choice.grep });
};

const resolveTestChoice = async (env: Environment) => {
  process.env.MOON_RECYCLE = "true";
  return await executeTests(env);
};

const resolveTailChoice = async () => {
  const ui = new inquirer.ui.BottomBar();

  await new Promise(async (resolve) => {
    const runningNode = MoonwallContext.getContext().nodes[0];
    const onData = (chunk: any) => ui.log.write(chunk.toString());
    runningNode.stderr!.on("data", onData);
    runningNode.stdout!.on("data", onData);
    inquirer
      .prompt({
        name: "exitTail",
        type: "press-to-continue",
        anyKey: true,
        pressToContinueMessage: " Press any key to stop tailing logs and go back  ↩️",
      })
      .then(() => {
        runningNode.stderr!.off("data", onData);
        runningNode.stdout!.off("data", onData);
        resolve("");
      });

    // TODO: Extend W.I.P below so support interactive tests whilst tailing logs

    // ui.updateBottomBar(
    //   `Press ${chalk.bgWhite.bgBlack("Q")} to go back, or ${chalk.bgWhite.bgBlack(
    //     "T"
    //   )} to execute tests ...`
    // );
    // inquirer
    //   .prompt({
    //     name: "char",
    //     type: "input",
    //     filter(val: string) {
    //       const choice = val.toUpperCase();
    //       switch (choice) {
    //         case "Q":
    //           runningNode.stderr!.off("data", onData);
    //           runningNode.stdout!.off("data", onData);
    //           return;

    //         case "T":
    //           new Promise(async (resolve)=>{
    //             const globalConfig = await importJsonConfig();
    //             const env = globalConfig.environments.find(
    //               ({ name }) => name === process.env.MOON_TEST_ENV
    //             )!;
    //             await resolveTestChoice(env);
    //             resolve(true)
    //           })
    //           break;

    //         default:
    //           ui.updateBottomBar(`Invalid input: ${chalk.redBright(choice)}/n`);
    //           break;
    //       }
    //     },
    //   })
    //   .then(() => resolve(true));
  });
};
