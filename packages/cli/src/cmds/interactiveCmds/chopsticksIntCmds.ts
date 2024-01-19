import { promises as fsPromises } from "fs";
import inquirer from "inquirer";
import WebSocket from "ws";
import { parse } from "yaml";
import { importJsonConfig } from "../../lib/configReader";

export async function resolveChopsticksInteractiveCmdChoice() {
  const globalConfig = importJsonConfig();
  const config = globalConfig.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;

  if (config.foundation.type !== "chopsticks") {
    throw new Error("Only chopsticks is supported, this is a bug please raise an issue.");
  }

  const isMultiChain = config.foundation.launchSpec.length > 1;

  const promptNode = async () => {
    if (config.foundation.type !== "chopsticks") {
      throw new Error("Only chopsticks is supported, this is a bug please raise an issue.");
    }
    const nodes = config.foundation.launchSpec.map(({ name }) => name);

    const result = await inquirer.prompt({
      name: "name",
      type: "list",
      choices: nodes,
      message: `Which network would you like to interact with? `,
    });

    return result.name;
  };

  const nodeSelected = isMultiChain ? await promptNode() : config.foundation.launchSpec[0].name;

  const ports = await Promise.all(
    config.foundation.launchSpec
      .filter(({ name }) => name == nodeSelected)
      .map(async ({ configPath }) => {
        const yaml = parse((await fsPromises.readFile(configPath)).toString());
        return (yaml.port as string) || "8000";
      })
  );
  const port = parseInt(ports[0]);

  // TODO: Support multiple chains on chopsticks
  const sendNewBlockCmd = async (port: number, count: number = 1) => {
    if (config.foundation.type !== "chopsticks") {
      throw new Error("Only chopsticks is supported, this is a bug please raise an issue.");
    }

    const websocketUrl = `ws://127.0.0.1:${port}`;
    const socket = new WebSocket(websocketUrl);
    socket.on("open", () => {
      socket.send(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "dev_newBlock", params: [{ count }] })
      );
      socket.close();
    });
  };

  const choices = [
    { name: "🆗  Create Block", value: "createblock" },
    { name: "➡️  Create N Blocks", value: "createNBlocks" },
  ];

  // if (ctx){

  //   jump
  // }

  choices.push(...[new inquirer.Separator(), { name: "🔙  Go Back", value: "back" }]);

  const choice = await inquirer.prompt({
    name: "cmd",
    type: "list",
    choices,
    message: `What command would you like to run? `,
    default: "createBlock",
  });

  switch (choice.cmd) {
    case "createblock":
      await sendNewBlockCmd(port);
      break;

    case "createNBlocks": {
      const result = await new inquirer.prompt({
        name: "n",
        type: "number",
        message: `How many blocks? `,
      });

      await sendNewBlockCmd(port, result.n);

      break;
    }

    case "back":
      break;
  }

  return;
}
