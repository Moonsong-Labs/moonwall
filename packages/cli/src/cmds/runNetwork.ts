import { Environment } from "@moonwall/types";
import { ApiPromise } from "@polkadot/api";
import chalk from "chalk";
import clear from "clear";
import fs, { promises as fsPromises } from "fs";
import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
import WebSocket from "ws";
import { parse } from "yaml";
import { clearNodeLogs, reportLogLocation } from "../internal/cmdFunctions/tempLogs";
import { commonChecks } from "../internal/launcherCommon";
import { cacheConfig, importAsyncConfig, loadEnvVars } from "../lib/configReader";
import { MoonwallContext, runNetworkOnly } from "../lib/globalContext";
import { executeTests } from "./runTests";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

let lastSelected = 0;

export async function runNetworkCmd(args) {
  await cacheConfig();
  process.env.MOON_TEST_ENV = args.envName;
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === args.envName)!;

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
      message:
        `Environment : ${chalk.bgGray.cyanBright(args.envName)}\n` + "Please select a choice: ",
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
            foundation == "dev" || foundation == "chopsticks"
              ? `Command:   Run command on network (e.g. createBlock) (${chalk.bgGrey.cyanBright(
                  foundation
                )})`
              : chalk.dim(
                  `Not applicable for foundation type (${chalk.bgGrey.cyanBright(foundation)})`
                ),
          value: 3,
          short: "cmd",
          disabled: foundation !== "dev" && foundation !== "chopsticks",
        },
        {
          name:
            testFileDirs.length > 0
              ? "Test:      Execute tests registered for this environment   (" +
                chalk.bgGrey.cyanBright(testFileDirs) +
                ")"
              : chalk.dim("Test:    NO TESTS SPECIFIED"),
          value: 4,
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
          value: 5,
          disabled: testFileDirs.length > 0 ? false : true,
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
  ];

  if (env.foundation.type == "dev" && !env.foundation.launchSpec[0].retainAllLogs) {
    clearNodeLogs();
  }

  await runNetworkOnly();
  clear();
  const portsList = await reportServicePorts();
  reportLogLocation();
  portsList.forEach(({ port }) =>
    console.log(`  🖥️   https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A${port}`)
  );

  if (!args.GrepTest) {
    await inquirer.prompt(questions.find(({ name }) => name == "NetworkStarted"));
  } else {
    process.env.MOON_RECYCLE = "true";
    process.env.MOON_GREP = await args.GrepTest;
    await executeTests(env, { testNamePattern: await args.GrepTest });
  }

  mainloop: for (;;) {
    const choice = await inquirer.prompt(questions.find(({ name }) => name == "MenuChoice"));
    const env = globalConfig.environments.find(({ name }) => name === args.envName)!;

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
        const quit = await inquirer.prompt(questions.find(({ name }) => name == "Quit"));
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
  console.log(`Goodbye! 👋`);
  process.exit(0);
}

const reportServicePorts = async () => {
  const ctx = MoonwallContext.getContext();
  const portsList: { port: string; name: string }[] = [];
  const globalConfig = await importAsyncConfig();
  const config = globalConfig.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
  if (config.foundation.type == "dev") {
    const port =
      ctx.environment.nodes[0].args
        .find((a) => a.includes("ws-port") || a.includes("rpc-port"))!
        .split("=")[1] || "9944";
    portsList.push({ port, name: "dev" });
  } else if (config.foundation.type == "chopsticks") {
    portsList.push(
      ...(await Promise.all(
        config.foundation.launchSpec.map(async ({ configPath, name }) => {
          const yaml = parse((await fsPromises.readFile(configPath)).toString());
          return { name, port: yaml.port || "8000" };
        })
      ))
    );
  } else if (config.foundation.type == "zombie") {
    ctx.zombieNetwork!.relay.forEach(({ wsUri, name }) => {
      portsList.push({ name, port: wsUri.split("ws://127.0.0.1:")[1] });
    });

    Object.keys(ctx.zombieNetwork!.paras).forEach((paraId) => {
      ctx.zombieNetwork!.paras[paraId].nodes.forEach(({ wsUri, name }) => {
        portsList.push({ name, port: wsUri.split("ws://127.0.0.1:")[1] });
      });
    });
  }
  portsList.forEach(({ name, port }) =>
    console.log(`  🌐  Node ${name} has started, listening on ports - Websocket: ${port}`)
  );

  return portsList;
};

const resolveCommandChoice = async () => {
  const choice = await inquirer.prompt({
    name: "cmd",
    type: "list",
    choices: [
      { name: "🆗  Create Block", value: "createblock" },
      { name: "🆕  Create Unfinalized Block", value: "createUnfinalizedBlock" },
      { name: "#️⃣   Create N Blocks", value: "createNBlocks" },
      new inquirer.Separator(),
      { name: "🔙  Go Back", value: "back" },
    ],
    message: `What command would you like to run? `,
    default: "createBlock",
  });

  const ctx = await MoonwallContext.getContext().connectEnvironment();
  const api = ctx.providers.find((a) => a.type == "polkadotJs")!.api as ApiPromise;
  const globalConfig = await importAsyncConfig();
  const config = globalConfig.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;

  // TODO: Support multiple chains on chopsticks
  const sendNewBlockCmd = async (count: number = 1) => {
    const port =
      config.foundation.type == "chopsticks"
        ? await Promise.all(
            config.foundation.launchSpec.map(async ({ configPath }) => {
              const yaml = parse((await fsPromises.readFile(configPath)).toString());
              return yaml.port || "8000";
            })
          )
        : undefined;
    const websocketUrl = `ws://127.0.0.1:${port}`;
    const socket = new WebSocket(websocketUrl);
    socket.on("open", () => {
      socket.send(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "dev_newBlock", params: [{ count }] })
      );
      socket.close();
    });
  };

  switch (choice.cmd) {
    case "createblock":
      ctx.foundation == "dev"
        ? await api.rpc.engine.createBlock(true, true)
        : ctx.foundation == "chopsticks"
        ? await sendNewBlockCmd()
        : undefined;
      break;

    case "createUnfinalizedBlock":
      ctx.foundation == "chopsticks"
        ? console.log("Not supported")
        : await api.rpc.engine.createBlock(true, false);
      break;

    case "createNBlocks": {
      const result = await new inquirer.prompt({
        name: "n",
        type: "number",
        message: `How many blocks? `,
      });

      if (ctx.foundation == "dev") {
        const executeSequentially = async (remaining: number) => {
          if (remaining === 0) {
            return;
          }
          await api.rpc.engine.createBlock(true, true);
          await executeSequentially(remaining - 1);
        };
        await executeSequentially(result.n);
      }

      if (ctx.foundation == "chopsticks") {
        await sendNewBlockCmd(result.n);
      }

      break;
    }

    case "back":
      break;
  }

  return;
};

const resolveInfoChoice = async (env: Environment) => {
  console.log(chalk.bgWhite.blackBright("Node Launch args:"));
  console.dir(MoonwallContext.getContext().environment, { depth: null });
  console.log(chalk.bgWhite.blackBright("Launch Spec in Config File:"));
  console.dir(env, { depth: null });
  const portsList = await reportServicePorts();
  reportLogLocation();
  portsList.forEach(({ port }) =>
    console.log(`  🖥️   https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A${port}`)
  );
};

const resolveGrepChoice = async (env: Environment, silent: boolean = false) => {
  const choice = await inquirer.prompt({
    name: "grep",
    type: "input",
    message: `What pattern would you like to filter for (ID/Title): `,
    default: process.env.MOON_GREP || "D01T01",
  });
  process.env.MOON_RECYCLE = "true";
  process.env.MOON_GREP = await choice.grep;
  const opts = { testNamePattern: await choice.grep, silent };
  if (silent) {
    opts["reporters"] = ["dot"];
  }
  return await executeTests(env, opts);
};

const resolveTestChoice = async (env: Environment, silent: boolean = false) => {
  process.env.MOON_RECYCLE = "true";
  const opts = { silent };
  if (silent) {
    opts["reporters"] = ["dot"];
  }
  return await executeTests(env, opts);
};

const resolveTailChoice = async (env: Environment) => {
  let tailing: boolean = true;
  let zombieNodePointer: number = 0;
  let bottomBarContents = "";
  let switchNode: boolean;
  let zombieNodes: string[] | undefined;

  const resumePauseProse = [
    `, ${chalk.bgWhite.black("[p]")} - pause tail`,
    `, ${chalk.bgWhite.black("[r]")} - resume tail`,
  ];

  const bottomBarBase = `📜 Tailing Logs, commands: ${chalk.bgWhite.black(
    "[q]"
  )} - quit, ${chalk.bgWhite.black("[t]")} - test, ${chalk.bgWhite.black("[g]")} - grep test`;
  bottomBarContents = bottomBarBase + resumePauseProse[0];

  const ui = new inquirer.ui.BottomBar({
    bottomBar: bottomBarContents + "\n",
  });

  for (;;) {
    if (process.env.MOON_ZOMBIE_NODES) {
      zombieNodes = process.env.MOON_ZOMBIE_NODES
        ? process.env.MOON_ZOMBIE_NODES.split("|")
        : undefined;

      bottomBarContents =
        bottomBarBase +
        resumePauseProse[0] +
        `, ${chalk.bgWhite.black("[,]")} Next Log, ${chalk.bgWhite.black(
          "[.]"
        )} Previous Log  | CurrentLog: ${`${zombieNodes[zombieNodePointer]} (${
          zombieNodePointer + 1
        }/${zombieNodes.length})`}`;
      ui.updateBottomBar(bottomBarContents + "\n");
    }

    switchNode = false;
    await new Promise(async (resolve) => {
      const onData = (chunk: any) => ui.log.write(chunk.toString());
      const logFilePath = process.env.MOON_MONITORED_NODE
        ? process.env.MOON_MONITORED_NODE
        : process.env.MOON_LOG_LOCATION;

      // eslint-disable-next-line prefer-const
      let currentReadPosition = 0;

      const printLogs = (newReadPosition: number, currentReadPosition: number) => {
        const stream = fs.createReadStream(logFilePath, {
          start: currentReadPosition,
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
        zombieNodePointer = (zombieNodePointer - 1) % zombieNodes.length;
      };

      printLogs(fs.statSync(logFilePath).size, 0);

      const renderBottomBar = (...parts: any[]) => {
        ui.updateBottomBar(bottomBarBase + " " + parts?.join(" ") + "\n");
      };

      const handleInputData = async (key: any) => {
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
          ui.rl.input.removeListener("data", handleInputData);
          ui.rl.input.pause();
          fs.unwatchFile(logFilePath);
          resolve("");
        }

        if (char === "t") {
          await resolveTestChoice(env, true);
          renderBottomBar(resumePauseProse[tailing ? 0 : 1]);
        }

        if (char === ",") {
          ui.rl.input.removeListener("data", handleInputData);
          ui.rl.input.pause();
          fs.unwatchFile(logFilePath);
          switchNode = true;
          incrPtr();
          resolve("");
        }

        if (char === ".") {
          ui.rl.input.removeListener("data", handleInputData);
          ui.rl.input.pause();
          fs.unwatchFile(logFilePath);
          switchNode = true;
          decrPtr();
          resolve("");
        }

        if (char === "g") {
          ui.rl.input.pause();
          tailing = false;
          await resolveGrepChoice(env, true);
          renderBottomBar(resumePauseProse[tailing ? 0 : 1]);
          tailing = true;
          ui.rl.input.resume();
        }

        ui.rl.input.resume();
      };

      ui.rl.input.on("data", handleInputData);

      fs.watchFile(logFilePath, () => {
        readLog();
      });
    });

    if (!switchNode) {
      break;
    }
  }

  ui.close();
};
