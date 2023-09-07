import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);
import fs from "fs/promises";
import { Environment, FoundationType, MoonwallConfig } from "@moonwall/types";
import { parseZombieConfigForBins } from "../../lib/configReader";
import { checkAlreadyRunning, downloadBinsIfMissing, promptAlreadyRunning } from "../fileCheckers";
import path from "path";

export async function createFolders() {
  await fs.mkdir("scripts").catch(() => "scripts folder already exists, skipping");
  await fs.mkdir("tests").catch(() => "tests folder already exists, skipping");
  await fs.mkdir("tmp").catch(() => "tmp folder already exists, skipping");
}

export async function generateConfig() {
  for (;;) {
    if (await fs.access("moonwall.config.json").catch(() => true)) {
      const answers = await inquirer.prompt(generateQuestions);
      const proceed = await inquirer.prompt(questions.find(({ name }) => name === "Confirm"));

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

      await fs.writeFile("moonwall.config.json", JSONBlob, "utf-8");
      // await fs.writeFile("moonwall.config.ts", getBody(answers), "utf-8");
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
];

export function createConfig(options: {
  label: string;
  timeout: number;
  environmentName: string;
  foundation: FoundationType;
  testDir: string;
}): MoonwallConfig {
  return {
    $schema:
      "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/packages/types/config_schema.json",
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


export async function zombieBinCheck(env: Environment) {
  if (env.foundation.type !== "zombie") {
    throw new Error("This function is only for zombie environments");
  }
  
  const bins = parseZombieConfigForBins(env.foundation.zombieSpec.configPath);
  const pids = bins.flatMap((bin) => checkAlreadyRunning(bin));
  pids.length == 0 || process.env.CI || (await promptAlreadyRunning(pids));
}

export async function devBinCheck(env: Environment) {
  if (env.foundation.type !== "dev") {
    throw new Error("This function is only for dev environments");
  }

  const binName = path.basename(env.foundation.launchSpec[0].binPath);
  const pids = checkAlreadyRunning(binName);
  pids.length == 0 || process.env.CI || (await promptAlreadyRunning(pids));
  await downloadBinsIfMissing(env.foundation.launchSpec[0].binPath);
}

