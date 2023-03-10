import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);
import fs from "fs/promises";
import { FoundationType, MoonwallConfig } from "../types/config.js";
import { option } from "yargs";

export async function generateConfig() {
  while (true) {
    if (await fs.access("moonwall.config.json").catch(() => true)) {
      const answers = await inquirer.prompt(generateQuestions);
      // console.dir(answers, { depth: null });

      const proceed = await inquirer.prompt(
        questions.find(({ name }) => name === "Confirm")
      );

      if (proceed.Confirm === false) {
        continue;
      }
      await fs.writeFile(
        "moonwall.config.json",
        JSON.stringify(
          createConfig({
            label: answers.Label,
            timeout: answers.Timeout,
            environmentName: answers.EnvironmentName,
            foundation: answers.EnvironmentFoundation,
            testDir: answers.EnvironmentTestDir,
          }),
          null,
          3
        ),
        "utf-8"
      );
      // await fs.writeFile("moonwall.config.ts", getBody(answers), "utf-8");
      break;
    } else {
      console.log("âšī¸  Config file already exists at this location. Quitting.");
      return;
    }
  }
  console.log(`Goodbye! đ`);
}

const generateQuestions = [
  {
    name: "Label",
    type: "input",
    message: "Provide a label for the config file",
    default: "moonwall_config",
  },
  {
    name: "Timeout",
    type: "number",
    message: "Provide a global timeout value",
    default: 30000,
    validate: (input: string) => {
      const pass = /^\d+$/.test(input);
      if (pass) {
        return true;
      }
      return "Please enter a valid number â";
    },
  },
  {
    name: "EnvironmentName",
    type: "input",
    message: "Provide a name for this environment",
    default: "default_env",
  },
  {
    name: "EnvironmentTestDir",
    type: "input",
    message: "Provide the path for where tests for this environment are kept",
    default: "tests/",
  },
  {
    name: "EnvironmentFoundation",
    type: "list",
    message: "What type of network foundation is this?",
    choices: ["dev", "chopsticks", "read_only", "fork", "zombie"],
    default: "tests/",
  },
];
const questions = [
  {
    name: "Confirm",
    type: "confirm",
    message:
      "Would you like to generate this config? (no to restart from beginning)",
  },
  {
    name: "Success",
    type: "press-to-continue",
    anyKey: true,
    pressToContinueMessage:
      "đ moonwall.config.ts has been generated. Press any key to exit  â\n",
  },
  {
    name: "Failure",
    type: "press-to-continue",
    anyKey: true,
    pressToContinueMessage:
      "Config has not been generated due to errors, Press any key to exit  â\n",
  },
];

export function createConfig(options: {
  label: string;
  timeout: number;
  environmentName: string;
  foundation: FoundationType;
  testDir: string;
}): MoonwallConfig {
  return {
    label: options.label,
    defaultTestTimeout: options.timeout,
    environments: [
      {
        name: options.environmentName,
        testFileDir: [options.testDir],
        foundation: {
          type: options.foundation as any,
        },
        connections: [
          {
            name: "SAMPLE",
            type: "ethers",
            endpoints: ["wss://moonriver.api.onfinality.io/public-ws"],
          },
        ],
      },
    ],
  };
}
