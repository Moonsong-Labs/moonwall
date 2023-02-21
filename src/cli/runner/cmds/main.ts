import chalk from "chalk";
import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
import { importConfig } from "../../../utils/configReader.js";
import { MoonwallConfig } from "../../../types/config.js";
import { generateConfig } from "./generateConfig.js";
import colors from "colors";
import { Result } from "ethers";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

export async function main() {
  while (true) {
    let globalConfig: MoonwallConfig;
    try {
      globalConfig = await importConfig("../../moonwall.config.js");
    } catch (e) {}

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
          ? "1) Initialise:         Generate a new Moonwall Config File."
          : chalk.dim("1) Initialise:     CONFIG ALREADY GENERATED"),
        value: 0,
        short: "init",
        disabled: configPresent,
      },
      {
        name: configPresent
          ? `2) Run Network:      Run a network from specified environments.`
          : chalk.dim("2) Run Network:      NO CONFIG FOUND"),
        value: 1,
        short: "run",
        disabled: !configPresent,
      },
      {
        name: configPresent
          ? "3) Run Tests:        Execute a test pack, spinning up a network if needed."
          : chalk.dim("2) Run Tests:        NO CONFIG FOUND"),
        value: 2,
        short: "test",
        disabled: !configPresent,
      },
      {
        name: `4) Quit Application`,
        value: 3,
        short: "quit",
      },
    ],
    filter(val) {
      return val;
    },
  };

  const answers = await inquirer.prompt(questionList);

  switch (answers.MenuChoice) {
    case 0:
      await generateConfig();
      return false;
    case 3:
      return await resolveQuitChoice();
  }
}

const resolveQuitChoice = async () => {
  const result =  await inquirer.prompt({
    name: "Quit",
    type: "confirm",
    message: "Are you sure you want to Quit?",
    default: false,
  });
  return result.Quit
};

const printIntro = () => {
  const logo = `\n                                             
                                                                                
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
                                                                                
                                                                                
            ***   ************************************************************  
                                                                                
****  *********************************************                                                     
                                                                                
            ***   ******************************************************        
                                                                                
    **   ***********************   *********************************************
    **   ***********************    ********************************************
                                                                                
                                      ***  ******************************       
                                                                                
                      ****  *****************************                       
                                                                                                                                                              
`;
  console.log(logo);
  console.log(
    colors.rainbow(
      "======================================================================"
    )
  );
  console.log(
    chalk.bgMagenta.cyanBright(
      "                               MOONWALL                               "
    )
  );
  console.log(
    colors.rainbow(
      "======================================================================\n"
    )
  );
};
