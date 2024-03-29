import type { FoundationType, MoonwallConfig } from "@moonwall/types";
import fs from "node:fs/promises";
import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

export async function createFolders() {
  await fs.mkdir("scripts").catch(() => "scripts folder already exists, skipping");
  await fs.mkdir("tests").catch(() => "tests folder already exists, skipping");
  await fs.mkdir("tmp").catch(() => "tmp folder already exists, skipping");
}

export async function generateConfig() {
  for (;;) {
    if (await fs.access("moonwall.config.json").catch(() => true)) {
      const answers = await inquirer.prompt(generateQuestions);
      const question = questions.find(({ name }) => name === "Confirm");
      if (!question) {
        throw new Error("Question not found");
      }
      const proceed = await inquirer.prompt(question);

      if (proceed.Confirm === false) {
        continue;
      }

      const JSONBlob = JSON.stringify(
        createConfig({
          label: answers.Label,
          timeout: answers.Timeout,
          environmentName: answers.EnvironmentName,
          foundation: answers.EnvironmentFoundation,
          testDir: answers.EnvironmentTestDir,
        }),
        null,
        3
      );

      await fs.writeFile("moonwall.config", textBlob + JSONBlob, "utf-8");
      process.env.MOON_CONFIG_PATH = "./moonwall.config";
      break;
    }
    console.log("ℹ️  Config file already exists at this location. Quitting.");
    return;
  }
  console.log("Goodbye! 👋");
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
      return "Please enter a valid number ❌";
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
    message: "Would you like to generate this config? (no to restart from beginning)",
  },
  {
    name: "Success",
    type: "press-to-continue",
    anyKey: true,
    pressToContinueMessage: "📄 moonwall.config.ts has been generated. Press any key to exit  ✅\n",
  },
  {
    name: "Failure",
    type: "press-to-continue",
    anyKey: true,
    pressToContinueMessage:
      "Config has not been generated due to errors, Press any key to exit  ❌\n",
  },
] as const;

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
      },
    ],
  };
}

const textBlob = `// This Moonwall Config file should be modified to include all types
// of environments you wish to test against.

// For more information on how to configure Moonwall, please visit:
// https://moonsong-labs.github.io/moonwall/config/intro.html\n`;
