import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);
import fs from "fs/promises";
import fse from "fs-extra";

export async function generateConfig() {
  try {
    if (await fs.access("moonwall.config.ts").catch(() => true)) {
      const answers = await inquirer
        .prompt(questions.filter(({ name }) => name.match("Ask")))
        .then((answers) => answers);

      await fs.writeFile("moonwall.config.ts", getBody(answers), "utf-8");
    } else {
      console.log("ℹ️  Config file already exists at this location. Quitting.");
      return;
    }

    await inquirer.prompt(questions.find((a) => a.name == "Success"));
  } catch (e) {
    await inquirer.prompt(
      questions.find((a) => {
        console.error(e);
        return a.name == "Failure";
      })
    );
  }
}

const questions = [
  {
    name: "AskLabel",
    type: "input",
    message: "Provide a label for the config file",
    default: "moonwall_config",
  },
  {
    name: "AskTimeout",
    type: "input",
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
    name: "AskEnvironmentName",
    type: "input",
    message: "Provide a name for this environment",
    default: "default_env",
  },
  {
    name: "AskEnvironmentTestDir",
    type: "input",
    message: "Provide the path for where tests for this environment are kept",
    default: "tests/",
  },
  {
    name: "AskEnvironmentFoundation",
    type: "list",
    message: "What type of network foundation is this?",
    choices: ["ReadOnly", "Dev", "Forked", "ZombieNet", "Chopsticks"],
    default: "tests/",
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
    'import { Foundation, ProviderType } from "src/types/enum.js";\n' +
    'import { MoonwallConfig } from "src/types/config.js";\n' +
    `\n
  export const globalConfig: MoonwallConfig = {
  label: "${answers.AskLabel}",
  defaultTestTimeout: ${answers.AskTimeout},
  environments: [
    {
      name: "${answers.AskEnvironmentName}",
      testFileDir: "${answers.AskEnvironmentTestDir}",
      foundation: {
        type: Foundation.${answers.AskEnvironmentFoundation},
        // Provide additional config here if you are starting a new network
      },
      connections: [
        // Provide config here for connecting providers
      ]
    },
    // Add additional environments as required
  ],
};`
  );
};
