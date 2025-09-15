import { jsx as _jsx } from "react/jsx-runtime";
import chalk from "chalk";
import clear from "clear";
import { promises as fsPromises } from "node:fs";
import { render } from "ink";
import { LogViewer as LogStreamer } from "./components/LogViewer";
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
import { confirm, input, select, Separator } from "@inquirer/prompts";
let lastSelected = 0;
export async function runNetworkCmd(args) {
  await cacheConfig();
  process.env.MOON_TEST_ENV = args.envName;
  if (args.subDirectory) {
    process.env.MOON_SUBDIR = args.subDirectory;
  }
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === args.envName);
  if (!env) {
    const envList = globalConfig.environments
      .map((env) => env.name)
      .sort()
      .join(", ");
    throw new Error(
      `No environment found in config for: ${chalk.bgWhiteBright.blackBright(args.envName)}\n Environments defined in config are: ${envList}\n`
    );
  }
  loadEnvVars();
  await commonChecks(env);
  const testFileDirs = env.testFileDir;
  const foundation = env.foundation.type;
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
    await input({ message: "✅  Press any key to continue...\n" });
  } else {
    process.env.MOON_RECYCLE = "true";
    process.env.MOON_GREP = args.GrepTest;
    await executeTests(env, { testNamePattern: args.GrepTest, subDirectory: args.subDirectory });
  }
  mainloop: for (;;) {
    const menuChoice = await select({
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
              ? `Test:      Execute tests registered for this environment   (${chalk.bgGrey.cyanBright(testFileDirs)})`
              : chalk.dim("Test:    NO TESTS SPECIFIED"),
          value: 4,
          disabled: !(testFileDirs.length > 0),
          short: "test",
        },
        {
          name:
            testFileDirs.length > 0
              ? `GrepTest:  Execute individual test(s) based on grepping the name / ID (${chalk.bgGrey.cyanBright(testFileDirs)})`
              : chalk.dim("Test:    NO TESTS SPECIFIED"),
          value: 5,
          disabled: !(testFileDirs.length > 0),
          short: "grep",
        },
        new Separator(),
        {
          name: "Quit:      Close network and quit the application",
          value: 6,
          short: "quit",
        },
      ],
    });
    const env = globalConfig.environments.find(({ name }) => name === args.envName);
    if (!env) {
      throw new Error("Environment not found in config. This is an error, please raise.");
    }
    switch (menuChoice) {
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
        const quit = await confirm({
          message: "ℹ️  Are you sure you'd like to close network and quit? \n",
          default: false,
        });
        if (quit === true) {
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
  const portsList = [];
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
const resolveInfoChoice = async (env) => {
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
const resolveGrepChoice = async (env, silent = false) => {
  const grep = await input({
    message: "What pattern would you like to filter for (ID/Title): ",
    default: process.env.MOON_GREP || "D01T01",
  });
  process.env.MOON_RECYCLE = "true";
  process.env.MOON_GREP = grep;
  const opts = {
    testNamePattern: grep,
    silent,
    subDirectory: process.env.MOON_SUBDIR,
  };
  if (silent) {
    opts.reporters = ["dot"];
  }
  return await executeTests(env, opts);
};
const resolveTestChoice = async (env, silent = false) => {
  process.env.MOON_RECYCLE = "true";
  const opts = { silent, subDirectory: process.env.MOON_SUBDIR };
  if (silent) {
    opts.reporters = ["dot"];
  }
  return await executeTests(env, opts);
};
const resolveTailChoice = async (env) => {
  let zombieNodePointer = 0;
  let switchNode;
  let zombieNodes;
  if (process.env.MOON_ZOMBIE_NODES) {
    zombieNodes = process.env.MOON_ZOMBIE_NODES.split("|");
  }
  for (;;) {
    switchNode = false;
    await new Promise(async (resolve) => {
      const logFilePath = process.env.MOON_ZOMBIE_NODES
        ? `${process.env.MOON_ZOMBIE_DIR}/${zombieNodes?.[zombieNodePointer]}.log`
        : process.env.MOON_LOG_LOCATION;
      if (!logFilePath) {
        throw new Error("No log file path resolved, this should not happen. Please raise defect");
      }
      const { waitUntilExit } = render(
        _jsx(LogStreamer, {
          env: env,
          logFilePath: logFilePath,
          onExit: () => resolve(),
          onNextLog: zombieNodes
            ? () => {
                switchNode = true;
                zombieNodePointer = (zombieNodePointer + 1) % zombieNodes.length;
                resolve();
              }
            : undefined,
          onPrevLog: zombieNodes
            ? () => {
                switchNode = true;
                zombieNodePointer =
                  (zombieNodePointer - 1 + zombieNodes.length) % zombieNodes.length;
                resolve();
              }
            : undefined,
          zombieInfo: zombieNodes
            ? {
                currentNode: zombieNodes[zombieNodePointer],
                position: zombieNodePointer + 1,
                total: zombieNodes.length,
              }
            : undefined,
        })
      );
      await waitUntilExit();
    });
    if (!switchNode) {
      break;
    }
  }
};
//# sourceMappingURL=runNetwork.js.map
