import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);
import fs from "fs/promises";

export async function generateConfig() {
  while (true) {
    if (await fs.access("moonwall.config.ts").catch(() => true)) {
      const answers = await inquirer.prompt(generateQuestions);
      console.dir(answers, { depth: null });

      const proceed = await inquirer.prompt(
        questions.find(({ name }) => name === "Confirm")
      );

      if (proceed.Confirm === false) {
        continue;
      }
      await fs.writeFile("moonwall.config.ts", getBody(answers), "utf-8");
      break;
    } else {
      console.log("ℹ️  Config file already exists at this location. Quitting.");
      return;
    }
  }
  console.log(`Goodbye! 👋`);
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
    choices: ["ReadOnly", "Dev", "Forked", "ZombieNet", "Chopsticks"],
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
      "📄 moonwall.config.ts has been generated. Press any key to exit  ✅\n",
  },
  {
    name: "Failure",
    type: "press-to-continue",
    anyKey: true,
    pressToContinueMessage:
      "Config has not been generated due to errors, Press any key to exit  ❌\n",
  },
];

const getBody = (answers) => {
  return (
    'import { MoonwallConfig, Foundation, ProviderType } from "moonwall";\n\n' +
    `    export default function globalConfig(): MoonwallConfig {
      return {
        label: "${answers.Label}",
        defaultTestTimeout: ${answers.Timeout},
        environments: [
          {
            name: "${answers.EnvironmentName}",
            testFileDir: ["${answers.EnvironmentTestDir}"],
            foundation: {
              type: Foundation.${answers.EnvironmentFoundation},
              // Provide additional config here if you are starting a new network
            },
            connections: [
              // Provide config here for connecting providers
            ],
          },
          // Add additional environments as required
        ],
      };
    }`
  );
};
