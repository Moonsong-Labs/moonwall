import chalk from "chalk";
import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
import { importConfigDefault } from "../../utils/configReader.js";
import { MoonwallConfig } from "../../types/config.js";
import { generateConfig } from "./generateConfig.js";
import colors from "colors";
import clear from "clear";
import { runNetwork } from "./runNetwork.js";
import { testCmd } from "./runTests.js";
import { downloader } from "./downloader.js";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

export async function main() {
  while (true) {
    let globalConfig;
    try {
      globalConfig = await importConfigDefault();
    } catch (e) {
      console.log(e)
    }
    clear();
    printIntro();
    if (await mainMenu(globalConfig)) {
      break;
    } else {
      continue;
    }
  }

  console.log(`Goodbye! 👋`);
  process.exit(0);
}

async function mainMenu(config: MoonwallConfig) {
  const configPresent = config !== undefined;
  const questionList = {
    name: "MenuChoice",
    type: "list",
    message: `Main Menu - Please select one of the following:`,
    default: 0,
    pageSize: 10,
    choices: [
      {
        name: !configPresent
          ? "1) Initialise:               Generate a new Moonwall Config File."
          : chalk.dim("1) Initialise:           ✅  CONFIG ALREADY GENERATED"),
        value: "init",
        disabled: configPresent,
      },
      {
        name: configPresent
          ? `2) Run Network:            Run a network from specified environments.`
          : chalk.dim("2) Run Network:            NO CONFIG FOUND"),
        value: "run",
        disabled: !configPresent,
      },
      {
        name: configPresent
          ? "3) Run Tests:              Execute a test pack, spinning up a network if needed."
          : chalk.dim("3) Run Tests:              NO CONFIG FOUND"),
        value: "test",

        disabled: !configPresent,
      },
      {
        name: chalk.dim("4) Batch-Run Tests:      🏗️  NOT YET IMPLEMENTED "),
        value: "batch",

        disabled: true,
      },
      {
        name: configPresent
          ? "5) Download:               Download node binaries or runtime wasms."
          : chalk.dim("5) Download:              NO CONFIG FOUND"),
        value: "download",

        disabled: false,
      },
      {
        name: `6) Quit Application`,
        value: "quit",
      },
    ],
    filter(val) {
      return val;
    },
  };

  const answers = await inquirer.prompt(questionList);

  switch (answers.MenuChoice) {
    case "init":
      await generateConfig();
      return false;
    case "run":
      const chosenRunEnv = await chooseRunEnv(config);
      await runNetwork(chosenRunEnv);
      return false;
    case "test":
      const chosenTestEnv = await chooseTestEnv(config);
      await testCmd(chosenTestEnv);
      return false;
    case "download":
      await resolveDownloadChoice();
      return false;
    case "quit":
      return await resolveQuitChoice();
  }
}

async function resolveDownloadChoice() {
  const args = await inquirer.prompt([
    {
      name: "artifact",
      type: "list",
      message: `Download - which artifact?`,
      choices: [
        "moonbeam",
        "polkadot",
        "moonbase-runtime",
        "moonriver-runtime",
        "moonbeam-runtime",
      ],
    },
    {
      name: "binVersion",
      type: "input",
      default: "latest",
      message: `Download - which version?`,
    },
    {
      name: "path",
      type: "input",
      message: `Download - where would you like it placed?`,
      default: "./",
    },
  ]);
  await downloader(args);
  await inquirer.prompt({
    name: "NetworkStarted",
    type: "press-to-continue",
    anyKey: true,
    pressToContinueMessage: `✅ ${args.artifact} has been downloaded. Press any key to continue...\n`,
  });
}

const chooseTestEnv = async (config: MoonwallConfig) => {
  const envs = config.environments
    .map((a) => ({
      name: `Env: ${a.name}     (${a.foundation.type})`,
      value: a.name,
      disabled: false,
    }))
    .sort((a, b) => (a.name > b.name ? -1 : +1));

  const result = await inquirer.prompt({
    name: "envName",
    message: "Select a environment to run",
    type: "list",
    choices: envs,
  });

  return result;
};

const chooseRunEnv = async (config: MoonwallConfig) => {
  const envs = config.environments.map((a) => {
    const result = { name: "", value: a.name, disabled: false };
    if (a.foundation.type === "dev" || a.foundation.type === "chopsticks") {
      result.name = `Env: ${a.name}     (${a.foundation.type})`;
    } else {
      result.name = chalk.dim(
        `Env: ${a.name} (${a.foundation.type})     NO NETWORK TO RUN`
      );
      result.disabled = true;
    }
    return result;
  });

  const choices = [
    ...envs
      .filter(({ disabled }) => disabled === false)
      .sort((a, b) => (a.name > b.name ? 1 : -1)),
    new inquirer.Separator(),
    ...envs
      .filter(({ disabled }) => disabled === true)
      .sort((a, b) => (a.name > b.name ? 1 : -1)),
  ];

  const result = await inquirer.prompt({
    name: "envName",
    message: "Select a environment to run",
    type: "list",
    choices,
  });

  return result;
};

const resolveQuitChoice = async () => {
  const result = await inquirer.prompt({
    name: "Quit",
    type: "confirm",
    message: "Are you sure you want to Quit?",
    default: false,
  });
  return result.Quit;
};

const printIntro = () => {
  const logo =
    chalk.cyan(`\n                                                                                                                  
                                      ####################                      
                                  ############################                  
                               ###################################              
                            ########################################            
                           ###########################################          
                         ##############################################         
                        ################################################        
                       .#################################################       
                       ##################################################       
                       ##################################################       
`) +
    chalk.magenta(`                                                                                
            ***   ************************************************************  
                                                                                
****  *********************************************                                                     
                                                                                
            ***   ******************************************************        
                                                                                
    **   ***********************   *********************************************
    **   ***********************    ********************************************
                                                                                
                                      ***  ******************************       
                                                                                
                      ****  *****************************                       
                                                                                                                                                              
`);
  console.log(logo);
  console.log(
    colors.rainbow(
      "======================================================================"
    )
  );
  console.log(
    chalk.bgCyan.magenta(
      "                               MOONWALL                               "
    )
  );
  console.log(
    colors.rainbow(
      "======================================================================\n"
    )
  );
};
