import type { Environment } from "@moonwall/types";
import chalk from "chalk";
import clear from "clear";
import fs, { promises as fsPromises } from "node:fs";
import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
import { parse } from "yaml";
import { clearNodeLogs, reportLogLocation } from "../internal/cmdFunctions/tempLogs";
import { commonChecks } from "../internal/launcherCommon";
import {
  cacheConfig,
  getEnvironmentFromConfig,
  importAsyncConfig,
  loadEnvVars,
} from "../lib/configReader";
import { MoonwallContext, runNetworkOnly } from "../lib/globalContext";
import {
  resolveChopsticksInteractiveCmdChoice,
  resolveDevInteractiveCmdChoice,
  resolveZombieInteractiveCmdChoice,
} from "./interactiveCmds";
import { executeTests } from "./runTests";
import type { RunCommandArgs } from "./entrypoint";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

let lastSelected = 0;

export async function runNetworkCmd(args: RunCommandArgs) {
  await cacheConfig();
  process.env.MOON_TEST_ENV = args.envName;
  if (args.subDirectory) {
    process.env.MOON_SUBDIR = args.subDirectory;
  }
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === args.envName);

  if (!env) {
    const envList = globalConfig.environments.map((env) => env.name);
    throw new Error(
      `No environment found in config for: ${chalk.bgWhiteBright.blackBright(
        args.envName
      )}\n Environments defined in config are: ${envList}\n`
    );
  }

  loadEnvVars();

  await commonChecks(env);

  const testFileDirs = env.testFileDir;
  const foundation = env.foundation.type;
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
      message: `Environment : ${chalk.bgGray.cyanBright(args.envName)}\nPlease select a choice: `,
      default: () => lastSelected,
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
            foundation === "dev" || foundation === "chopsticks" || foundation === "zombie"
              ? `Command:   Run command on network (${chalk.bgGrey.cyanBright(foundation)})`
              : chalk.dim(
                  `Not applicable for foundation type (${chalk.bgGrey.cyanBright(foundation)})`
                ),
          value: 3,
          short: "cmd",
          disabled: foundation !== "dev" && foundation !== "chopsticks" && foundation !== "zombie",
        },
        {
          name:
            testFileDirs.length > 0
              ? `Test:      Execute tests registered for this environment   (${chalk.bgGrey.cyanBright(
                  testFileDirs
                )})`
              : chalk.dim("Test:    NO TESTS SPECIFIED"),
          value: 4,
          disabled: !(testFileDirs.length > 0),
          short: "test",
        },
        {
          name:
            testFileDirs.length > 0
              ? `GrepTest:  Execute individual test(s) based on grepping the name / ID (${chalk.bgGrey.cyanBright(
                  testFileDirs
                )})`
              : chalk.dim("Test:    NO TESTS SPECIFIED"),
          value: 5,
          disabled: !(testFileDirs.length > 0),
          short: "grep",
        },
        new inquirer.Separator(),
        {
          name: "Quit:      Close network and quit the application",
          value: 6,
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
  ] as const;

  if (
    (env.foundation.type === "dev" && !env.foundation.launchSpec[0].retainAllLogs) ||
    (env.foundation.type === "chopsticks" && !env.foundation.launchSpec[0].retainAllLogs)
  ) {
    clearNodeLogs();
  }

  await runNetworkOnly();
  clear();
  const portsList = await reportServicePorts();
  reportLogLocation();

  for (const { port } of portsList) {
    console.log(`  🖥️   https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A${port}`);
  }

  if (process.env.MOON_SUBDIR) {
    console.log(chalk.bgWhite.blackBright(`📍 Subdirectory Filter: ${process.env.MOON_SUBDIR}`));
  }

  if (!args.GrepTest) {
    const question = questions.find(({ name }) => name === "NetworkStarted");

    if (!question) {
      throw new Error("Question not found. This is a bug, please raise an issue.");
    }

    await inquirer.prompt(question);
  } else {
    process.env.MOON_RECYCLE = "true";
    process.env.MOON_GREP = args.GrepTest;
    await executeTests(env, { testNamePattern: args.GrepTest, subDirectory: args.subDirectory });
  }

  mainloop: for (;;) {
    const question = questions.find(({ name }) => name === "MenuChoice");
    if (!question) {
      throw new Error("Question not found. This is a bug, please raise an issue.");
    }
    const choice = await inquirer.prompt(question);
    const env = globalConfig.environments.find(({ name }) => name === args.envName);

    if (!env) {
      throw new Error("Environment not found in config. This is an error, please raise.");
    }

    switch (choice.MenuChoice) {
      case 1:
        clear();
        await resolveTailChoice(env);
        lastSelected = 0;
        clear();
        break;

      case 2:
        await resolveInfoChoice(env);
        lastSelected = 1;
        break;

      case 3:
        await resolveCommandChoice();
        lastSelected = 2;
        break;

      case 4:
        await resolveTestChoice(env);
        lastSelected = 3;
        break;

      case 5:
        await resolveGrepChoice(env);
        lastSelected = 4;
        break;

      case 6: {
        const question = questions.find(({ name }) => name === "Quit");
        if (!question) {
          throw new Error("Question not found. This is a bug, please raise an issue.");
        }
        const quit = await inquirer.prompt(question);
        if (quit.Quit === true) {
          break mainloop;
        }
        break;
      }
      default:
        throw new Error("invalid value");
    }
  }

  await MoonwallContext.destroy();
}

const reportServicePorts = async () => {
  const ctx = await MoonwallContext.getContext();
  const portsList: { port: string; name: string }[] = [];
  const config = getEnvironmentFromConfig();
  switch (config.foundation.type) {
    case "dev": {
      const args = ctx.environment.nodes[0].args;
      const explicitPortArg = args.find((a) => a.includes("ws-port") || a.includes("rpc-port"));
      const port = explicitPortArg ? explicitPortArg.split("=")[1] : "9944";
      portsList.push({ port, name: "dev" });
      break;
    }

    case "chopsticks": {
      portsList.push(
        ...(await Promise.all(
          config.foundation.launchSpec.map(async ({ configPath, name }) => {
            const yaml = parse((await fsPromises.readFile(configPath)).toString());
            return { name, port: yaml.port || "8000" };
          })
        ))
      );
      break;
    }

    case "zombie": {
      const zombieNetwork = ctx.zombieNetwork;

      if (!zombieNetwork) {
        throw new Error("Zombie network not found. This is a bug, please raise an issue.");
      }

      for (const { wsUri, name } of zombieNetwork.relay) {
        portsList.push({ name, port: wsUri.split("ws://127.0.0.1:")[1] });
      }

      for (const paraId of Object.keys(zombieNetwork.paras)) {
        for (const { wsUri, name } of zombieNetwork.paras[paraId].nodes) {
          portsList.push({ name, port: wsUri.split("ws://127.0.0.1:")[1] });
        }
      }
    }
  }

  for (const { port, name } of portsList) {
    console.log(`  🌐  Node ${name} has started, listening on ports - Websocket: ${port}`);
  }

  return portsList;
};

const resolveCommandChoice = async () => {
  const ctx = await (await MoonwallContext.getContext()).connectEnvironment();

  switch (ctx.foundation) {
    case "dev":
      await resolveDevInteractiveCmdChoice();
      break;

    case "chopsticks":
      await resolveChopsticksInteractiveCmdChoice();
      break;

    case "zombie":
      await resolveZombieInteractiveCmdChoice();
      break;
  }
};

const resolveInfoChoice = async (env: Environment) => {
  console.log(chalk.bgWhite.blackBright("Node Launch args:"));
  console.dir((await MoonwallContext.getContext()).environment, {
    depth: null,
  });
  console.log(chalk.bgWhite.blackBright("Launch Spec in Config File:"));
  console.dir(env, { depth: null });
  const portsList = await reportServicePorts();
  reportLogLocation();

  for (const { port } of portsList) {
    console.log(`  🖥️   https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A${port}`);
  }
  if (process.env.MOON_SUBDIR) {
    console.log(chalk.bgWhite.blackBright(`📍 Subdirectory Filter: ${process.env.MOON_SUBDIR}`));
  }
};

const resolveGrepChoice = async (env: Environment, silent = false) => {
  const choice = await inquirer.prompt({
    name: "grep",
    type: "input",
    message: "What pattern would you like to filter for (ID/Title): ",
    default: process.env.MOON_GREP || "D01T01",
  });
  process.env.MOON_RECYCLE = "true";
  process.env.MOON_GREP = await choice.grep;
  const opts: any = {
    testNamePattern: await choice.grep,
    silent,
    subDirectory: process.env.MOON_SUBDIR,
  };
  if (silent) {
    opts.reporters = ["dot"];
  }
  return await executeTests(env, opts);
};

const resolveTestChoice = async (env: Environment, silent = false) => {
  process.env.MOON_RECYCLE = "true";
  const opts: any = { silent, subDirectory: process.env.MOON_SUBDIR };
  if (silent) {
    opts.reporters = ["dot"];
  }
  return await executeTests(env, opts);
};

const resolveTailChoice = async (env: Environment) => {
  let tailing = true;
  let zombieNodePointer = 0;
  let bottomBarContents = "";
  let switchNode: boolean;
  let zombieContent: string;
  let zombieNodes: string[];

  const resumePauseProse = [
    `, ${chalk.bgWhite.black("[p]")} Pause tail`,
    `, ${chalk.bgWhite.black("[r]")} Resume tail`,
  ];

  const bottomBarBase = `📜 Tailing Logs, commands: ${chalk.bgWhite.black(
    "[q]"
  )} Quit, ${chalk.bgWhite.black("[t]")} Test, ${chalk.bgWhite.black("[g]")} Grep test`;

  bottomBarContents = bottomBarBase + resumePauseProse[0];

  const ui = new inquirer.ui.BottomBar({
    bottomBar: `${bottomBarContents}\n`,
  });

  for (;;) {
    clear();
    if (process.env.MOON_ZOMBIE_NODES) {
      zombieNodes = process.env.MOON_ZOMBIE_NODES.split("|");

      zombieContent = `, ${chalk.bgWhite.black("[,]")} Next Log, ${chalk.bgWhite.black(
        "[.]"
      )} Previous Log  | CurrentLog: ${chalk.bgWhite.black(
        `${zombieNodes[zombieNodePointer]} (${zombieNodePointer + 1}/${zombieNodes.length})`
      )}`;

      bottomBarContents = bottomBarBase + resumePauseProse[tailing ? 0 : 1] + zombieContent;

      ui.updateBottomBar(`${bottomBarContents}\n`);
    }

    switchNode = false;
    await new Promise(async (resolve) => {
      const onData = (chunk: any) => ui.log.write(chunk.toString());
      const logFilePath = process.env.MOON_ZOMBIE_NODES
        ? `${process.env.MOON_ZOMBIE_DIR}/${zombieNodes[zombieNodePointer]}.log`
        : process.env.MOON_LOG_LOCATION;

      if (!logFilePath) {
        throw new Error("No log file path resolved, this should not happen. Please raise defect");
      }

      let currentReadPosition = 0;

      const printLogs = (newReadPosition: number, curr: number) => {
        const stream = fs.createReadStream(logFilePath, {
          start: curr,
          end: newReadPosition,
        });
        stream.on("data", onData);
        stream.on("end", () => {
          currentReadPosition = newReadPosition;
        });
      };

      const readLog = () => {
        const stats = fs.statSync(logFilePath);
        const newReadPosition = stats.size;

        if (newReadPosition > currentReadPosition && tailing) {
          printLogs(newReadPosition, currentReadPosition);
        }
      };

      const incrPtr = () => {
        zombieNodePointer = (zombieNodePointer + 1) % zombieNodes.length;
      };

      const decrPtr = () => {
        zombieNodePointer = (zombieNodePointer - 1 + zombieNodes.length) % zombieNodes.length;
      };

      printLogs(fs.statSync(logFilePath).size, 0);

      const renderBottomBar = (...parts: any[]) => {
        const content = process.env.MOON_ZOMBIE_NODES
          ? `${bottomBarBase} ${parts?.join(" ")}${zombieContent}\n`
          : `${bottomBarBase} ${parts?.join(" ")}\n`;
        ui.updateBottomBar(content);
      };

      const handleInputData = async (key: any) => {
        // @ts-expect-error - internal method
        ui.rl.input.pause();
        const char = key.toString().trim();

        if (char === "p") {
          tailing = false;
          renderBottomBar(resumePauseProse[1]);
        }

        if (char === "r") {
          printLogs(fs.statSync(logFilePath).size, currentReadPosition);
          tailing = true;
          renderBottomBar(resumePauseProse[0]);
        }

        if (char === "q") {
          // @ts-expect-error - internal method
          ui.rl.input.removeListener("data", handleInputData);
          // @ts-expect-error - internal method
          ui.rl.input.pause();
          fs.unwatchFile(logFilePath);
          resolve("");
        }

        if (char === "t") {
          await resolveTestChoice(env, true);
          renderBottomBar(resumePauseProse[tailing ? 0 : 1]);
        }

        if (char === ",") {
          // @ts-expect-error - internal method
          ui.rl.input.removeListener("data", handleInputData);
          // @ts-expect-error - internal method
          ui.rl.input.pause();
          fs.unwatchFile(logFilePath);
          switchNode = true;
          incrPtr();
          resolve("");
        }

        if (char === ".") {
          // @ts-expect-error - internal method
          ui.rl.input.removeListener("data", handleInputData);
          // @ts-expect-error - internal method
          ui.rl.input.pause();
          fs.unwatchFile(logFilePath);
          switchNode = true;
          decrPtr();
          resolve("");
        }

        if (char === "g") {
          // @ts-expect-error - internal method
          ui.rl.input.pause();
          tailing = false;
          await resolveGrepChoice(env, true);
          renderBottomBar(resumePauseProse[tailing ? 0 : 1]);
          tailing = true;
          // @ts-expect-error - internal method
          ui.rl.input.resume();
        }
        // @ts-expect-error - internal method
        ui.rl.input.resume();
      };
      // @ts-expect-error - internal method
      ui.rl.input.on("data", handleInputData);

      fs.watchFile(logFilePath, () => {
        readLog();
      });
    });

    if (!switchNode) {
      break;
    }
  }
  // @ts-expect-error - internal method
  ui.close();
};
