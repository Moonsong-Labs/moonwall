import { FileSystem } from "@effect/platform-node";
import { MoonwallConfig } from "@moonwall/types";
import chalk from "chalk";
import clear from "clear";
import colors from "colors";
import { Effect } from "effect";
import fs from "fs";
import inquirer from "inquirer";
import PressToContinuePrompt from "inquirer-press-to-continue";
import fetch from "node-fetch";
import path from "path";
import { SemVer, lt } from "semver";
import pkg from "../../package.json" assert { type: "json" };
import { fetchArtifact, getVersions } from "../internal/cmdFunctions/fetchArtifact";
import { createFolders, generateConfig } from "../internal/cmdFunctions/initialisation";
import { executeScript } from "../internal/launcherCommon";
import { debuglogLevel, logLevel } from "../internal/logging";
import { importMoonwallConfig } from "../lib/configReader";
import { allReposAsync } from "../lib/repoDefinitions";
import { runNetworkCmdEffect } from "./runNetwork";
import { testEffect } from "./runTests";

inquirer.registerPrompt("press-to-continue", PressToContinuePrompt);

export const mainCmd = () =>
  Effect.gen(function* (_) {
    for (;;) {
      const globalConfig = yield* _(importMoonwallConfig());

      yield* _(Effect.sync(() => clear()));
      yield* _(Effect.promise(() => printIntro()));

      const cont = yield* _(Effect.promise(() => mainMenu(globalConfig)));

      if (cont) {
        break;
      } else {
        continue;
      }
    }
    yield* _(Effect.sync(()=> process.stdout.write(`Goodbye! 👋\n`)));
  });
  
async function mainMenu(config?: MoonwallConfig) {
  const configPresent = config !== undefined;
  const questionList = {
    name: "MenuChoice",
    type: "list",
    message: `Main Menu - Please select one of the following:`,
    default: 0,
    pageSize: 12,
    choices: !configPresent
      ? [
          {
            name: !configPresent
              ? "1) Initialise:                         Generate a new Moonwall Config File"
              : chalk.dim("1) Initialise:                       ✅  CONFIG ALREADY GENERATED"),
            value: "init",
          },
          {
            name: "2) Artifact Downloader:                Fetch artifacts (x86) from GitHub repos",
            value: "download",
          },
          {
            name: `3) Quit Application`,
            value: "quit",
          },
        ]
      : [
          {
            name: `1) Execute Script:                     Run scripts placed in your config defined script directory`,
            value: "exec",
          },
          {
            name: `2) Network Launcher & Toolbox:         Launch network, access tools: tail logs, interactive tests etc`,
            value: "run",
          },
          {
            name: "3) Test Suite Execution:               Run automated tests, start network if needed",
            value: "test",
          },

          {
            name: "4) Artifact Downloader:                Fetch artifacts (x86) from GitHub repos",
            value: "download",
          },
          {
            name: `5) Quit Application`,
            value: "quit",
          },
        ],
    filter(val: any) {
      return val;
    },
  };

  const answers = await inquirer.prompt(questionList as any);

  switch (answers.MenuChoice) {
    case "init":
      await generateConfig();
      await createFolders();
      return false;
    case "run": {
      const chosenRunEnv = await chooseRunEnv(config!);
      process.env.MOON_RUN_SCRIPTS = "true";
      if (chosenRunEnv.envName !== "back") {
        await Effect.runPromise(
          runNetworkCmdEffect(chosenRunEnv.envName).pipe(
            Effect.provide(FileSystem.layer),
            Effect.provide(debuglogLevel),
            Effect.provide(logLevel)
          )
        );
      }
      return false;
    }
    case "test": {
      const chosenTestEnv = await chooseTestEnv(config!);
      if (chosenTestEnv.envName !== "back") {
        process.env.MOON_RUN_SCRIPTS = "true";
        await Effect.runPromise(
          testEffect(chosenTestEnv.envName).pipe(
            Effect.provide(FileSystem.layer),
            Effect.provide(debuglogLevel),
            Effect.provide(logLevel)
          )
        );
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

    case "exec":
      return await resolveExecChoice(config!);

    default:
      throw new Error("Invalid choice");
  }
}

async function resolveExecChoice(config: MoonwallConfig) {
  const scriptDir = config.scriptsDir;

  if (!scriptDir) {
    await inquirer.prompt({
      name: "test complete",
      type: "press-to-continue",
      anyKey: true,
      pressToContinueMessage: `ℹ️  No scriptDir property defined at ${chalk.bgWhiteBright.black(
        "moonwall.config.json"
      )}\n Press any key to continue...\n`,
    });
    return false;
  }

  if (!fs.existsSync(scriptDir)) {
    await inquirer.prompt({
      name: "test complete",
      type: "press-to-continue",
      anyKey: true,
      pressToContinueMessage: `ℹ️  No scriptDir found at at ${chalk.bgWhiteBright.black(
        path.join(process.cwd(), scriptDir)
      )}\n Press any key to continue...\n`,
    });
    return false;
  }

  const files = await fs.promises.readdir(scriptDir);

  if (!files) {
    await inquirer.prompt({
      name: "test complete",
      type: "press-to-continue",
      anyKey: true,
      pressToContinueMessage: `ℹ️  No scripts found at ${chalk.bgWhiteBright.black(
        path.join(process.cwd(), config.scriptsDir!)
      )}\n Press any key to continue...\n`,
    });
  }

  const choices = files.map((file) => {
    const ext = getExtString(file);
    return { name: `${ext}:    ${path.basename(file, "")}`, value: file };
  });

  for (;;) {
    const result = await inquirer.prompt({
      name: "selections",
      message: "Select which scripts you'd like to run (press ↩️ with none selected to go 🔙)\n",
      type: "checkbox",
      choices,
    });

    if (result.selections.length === 0) {
      const result = await inquirer.prompt({
        name: "none-selected",
        message: "No scripts have been selected to run, do you wish to exit?",
        type: "confirm",
        default: true,
      });

      if (result["none-selected"]) {
        return false;
      } else {
        continue;
      }
    }

    for (const script of result.selections) {
      const result = await inquirer.prompt({
        name: "args",
        message: `Enter any arguments for ${chalk.bgWhiteBright.black(
          script
        )} (press enter for none)`,
        type: "input",
      });

      await executeScript(script, result.args);
    }

    await inquirer.prompt({
      name: "test complete",
      type: "press-to-continue",
      anyKey: true,
      pressToContinueMessage: `Press any key to continue...\n`,
    });
    return false;
  }
}

async function resolveDownloadChoice() {
  const binList = (await allReposAsync()).reduce((acc, curr) => {
    acc.push(...curr.binaries.map((bin: any) => bin.name).flat());
    acc.push(new inquirer.Separator());
    acc.push("Back");
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
      name: `[${a.foundation.type}] ${a.name}${a.description ? ": \t\t" + a.description : ""}`,
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
      result.name = `[${a.foundation.type}] ${a.name}${
        a.description ? ": \t\t" + a.description : ""
      }`;
    } else {
      result.name = chalk.dim(`[${a.foundation.type}] ${a.name}     NO NETWORK TO RUN`);
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

const resolveQuitChoice = async (): Promise<boolean> => {
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
    remoteVersion = json
      .find((a) => a.tag_name.includes("@moonwall/cli@"))!
      .tag_name.split("@")[2]!;
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
    chalk.red(`                                                                                
🧱🧱🧱   🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱  🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱
  🧱🧱🧱🧱  🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱
              🧱🧱🧱   🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱
      🧱🧱   🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱   🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱
        🧱🧱   🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱    🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱
                                       🧱🧱🧱  🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱
                      🧱🧱🧱🧱  🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱🧱      
                                                                                                                                                              
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

const getExtString = (file: string) => {
  const ext = path.extname(file);
  switch (ext) {
    case ".js":
      return chalk.bgYellow.black(ext);
    case ".ts":
      return chalk.bgBlue.black(ext);
    case ".sh":
      return chalk.bgGreen.black(ext);
    default:
      return chalk.bgRed.black(ext);
  }
};
