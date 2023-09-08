import { MoonwallConfig } from "@moonwall/types";
import chalk from "chalk";
import clear from "clear";
import colors from "colors";
import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
import fetch from "node-fetch";
import { SemVer, lt } from "semver";
import pkg from "../../package.json" assert { type: "json" };
import { fetchArtifact, getVersions } from "../internal/cmdFunctions/fetchArtifact";
import { createFolders, generateConfig } from "../internal/cmdFunctions/initialisation";
import { importJsonConfig } from "../lib/configReader";
import ghRepos from "../lib/repoDefinitions";
import { runNetworkCmd } from "./runNetwork";
import { testCmd } from "./runTests";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

export async function main() {
  for (;;) {
    let globalConfig: MoonwallConfig | undefined;
    try {
      globalConfig = importJsonConfig();
    } catch (e) {
      console.log(e);
    }
    clear();
    await printIntro();
    if (await mainMenu(globalConfig)) {
      break;
    } else {
      continue;
    }
  }

  process.stdout.write(`Goodbye! 👋\n`);
  process.exit(0);
}

async function mainMenu(config: MoonwallConfig) {
  const configPresent = config !== undefined;
  const questionList = {
    name: "MenuChoice",
    type: "list",
    message: `Main Menu - Please select one of the following:`,
    default: 0,
    pageSize: 12,
    choices: [
      {
        name: !configPresent
          ? "1) Initialise:                         Generate a new Moonwall Config File."
          : chalk.dim("1) Initialise:                       ✅  CONFIG ALREADY GENERATED"),
        value: "init",
        disabled: configPresent,
      },
      {
        name: configPresent
          ? `2) Network Launcher & Toolbox:         Launch network, access tools: tail logs, interactive tests etc.`
          : chalk.dim("2) Network Launcher & Toolbox            NO CONFIG FOUND"),
        value: "run",
        disabled: !configPresent,
      },
      {
        name: configPresent
          ? "3) Test Suite Execution:               Run automated tests, start network if needed."
          : chalk.dim("3) Test Suite Execution:             NO CONFIG FOUND"),
        value: "test",

        disabled: !configPresent,
      },
      {
        name: chalk.dim("4) Batch-Run Tests:                  🏗️  NOT YET IMPLEMENTED "),
        value: "batch",

        disabled: true,
      },
      {
        name: "5) Artifact Downloader:                Fetch artifacts (x86) from GitHub repos.",
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
      await createFolders();
      return false;
    case "run": {
      const chosenRunEnv = await chooseRunEnv(config);
      process.env.MOON_RUN_SCRIPTS = "true";
      if (chosenRunEnv.envName !== "back") {
        await runNetworkCmd(chosenRunEnv);
      }
      return false;
    }
    case "test": {
      const chosenTestEnv = await chooseTestEnv(config);
      if (chosenTestEnv.envName !== "back") {
        process.env.MOON_RUN_SCRIPTS = "true";
        await testCmd(chosenTestEnv.envName);
        await inquirer.prompt({
          name: "test complete",
          type: "press-to-continue",
          anyKey: true,
          pressToContinueMessage: `ℹ️  Test run for ${chalk.bgWhiteBright.black(
            chosenTestEnv.envName
          )} has been completed. Press any key to continue...\n`,
        });
      }
      return false;
    }
    case "download":
      await resolveDownloadChoice();

      return false;
    case "quit":
      return await resolveQuitChoice();
  }
}

async function resolveDownloadChoice() {
  const binList = ghRepos().reduce((acc, curr) => {
    acc.push(...curr.binaries.map((bin) => bin.name).flat());
    acc.push(new inquirer.Separator());
    return acc;
  }, [] as string[]);

  for (;;) {
    const firstChoice = await inquirer.prompt({
      name: "artifact",
      type: "list",
      message: `Download - which artifact?`,
      choices: binList,
    });
    if (firstChoice.artifact === "Back") {
      return;
    }

    const versions = await getVersions(
      firstChoice.artifact,
      firstChoice.artifact.includes("runtime")
    );

    const chooseversion = await inquirer.prompt({
      name: "binVersion",
      type: "list",
      default: "latest",
      message: `Download - which version?`,
      choices: [...versions, new inquirer.Separator(), "Back", new inquirer.Separator()],
    });

    if (chooseversion.binVersion === "Back") {
      continue;
    }
    const chooseLocation = await inquirer.prompt({
      name: "path",
      type: "input",
      message: `Download - where would you like it placed?`,
      default: "./tmp",
    });

    const result = await inquirer.prompt({
      name: "continue",
      type: "confirm",
      message: `You are about to download ${chalk.bgWhite.blackBright(
        firstChoice.artifact
      )} v-${chalk.bgWhite.blackBright(chooseversion.binVersion)} to: ${chalk.bgWhite.blackBright(
        chooseLocation.path
      )}.\n Would you like to continue? `,
      default: true,
    });

    if (result.continue === false) {
      continue;
    }

    await fetchArtifact({
      bin: firstChoice.artifact,
      ver: chooseversion.binVersion,
      path: chooseLocation.path,
    });
    await inquirer.prompt({
      name: "NetworkStarted",
      type: "press-to-continue",
      anyKey: true,
      pressToContinueMessage: `✅ Artifact has been downloaded. Press any key to continue...\n`,
    });
    return;
  }
}

const chooseTestEnv = async (config: MoonwallConfig) => {
  const envs = config.environments
    .map((a) => ({
      name: `Env: ${a.name}     (${a.foundation.type})`,
      value: a.name,
      disabled: false,
    }))
    .sort((a, b) => (a.name > b.name ? -1 : +1));
  envs.push(
    ...([
      new inquirer.Separator(),
      { name: "Back", value: "back" },
      new inquirer.Separator(),
    ] as any)
  );
  const result = await inquirer.prompt({
    name: "envName",
    message: "Select a environment to run",
    type: "list",
    pageSize: 12,
    choices: envs,
  });

  return result;
};

const chooseRunEnv = async (config: MoonwallConfig) => {
  const envs = config.environments.map((a) => {
    const result = { name: "", value: a.name, disabled: false };
    if (
      a.foundation.type === "dev" ||
      a.foundation.type === "chopsticks" ||
      a.foundation.type === "zombie"
    ) {
      result.name = `Env: ${a.name}     (${a.foundation.type})`;
    } else {
      result.name = chalk.dim(`Env: ${a.name} (${a.foundation.type})     NO NETWORK TO RUN`);
      result.disabled = true;
    }
    return result;
  });

  const choices = [
    ...envs.filter(({ disabled }) => disabled === false).sort((a, b) => (a.name > b.name ? 1 : -1)),
    new inquirer.Separator(),
    ...envs.filter(({ disabled }) => disabled === true).sort((a, b) => (a.name > b.name ? 1 : -1)),
    new inquirer.Separator(),
    { name: "Back", value: "back" },
    new inquirer.Separator(),
  ];

  const result = await inquirer.prompt({
    name: "envName",
    message: "Select a environment to run",
    type: "list",
    pageSize: 12,
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

const printIntro = async () => {
  const currentVersion = new SemVer(pkg.version);

  interface GithubResponse {
    tag_name: `${string}@${string}`;
  }

  let remoteVersion = "";
  try {
    const url = "https://api.github.com/repos/moonsong-labs/moonwall/releases";
    const resp = await fetch(url);
    const json = (await resp.json()) as GithubResponse[];
    remoteVersion = json.find((a) => a.tag_name.includes("@moonwall/cli@"))!.tag_name.split("@")[2];
  } catch (error) {
    remoteVersion = "unknown";
    console.error(`Fetch Error: ${error}`);
  }

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
                                                                                                                                                              
\n`);
  process.stdout.write(logo);
  process.stdout.write(
    colors.rainbow(
      "================================================================================\n"
    )
  );

  if (remoteVersion !== "unknown" && lt(currentVersion, new SemVer(remoteVersion))) {
    process.stdout.write(
      chalk.bgCyan.white(
        `                 MOONWALL   V${currentVersion.version}   (New version ${remoteVersion} available!)             \n`
      )
    );
  } else {
    process.stdout.write(
      chalk.bgCyan.white(
        `                                MOONWALL  V${currentVersion.version}                                \n`
      )
    );
  }

  process.stdout.write(
    colors.rainbow(
      "================================================================================\n"
    )
  );
};
