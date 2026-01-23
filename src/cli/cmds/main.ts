import type { MoonwallConfig } from "../../api/types/index.js";
import chalk from "chalk";
import clear from "clear";
import colors from "colors";
import fs from "node:fs";
import cfonts from "cfonts";
import path from "node:path";
import { SemVer, lt } from "semver";
import pkg from "../../../package.json" with { type: "json" };
import {
  createFolders,
  deriveTestIds,
  executeScript,
  fetchArtifact,
  generateConfig,
  getVersions,
} from "../internal/index.js";
import { configExists, importAsyncConfig } from "../lib/configReader.js";
import { allReposAsync, standardRepos } from "../lib/repoDefinitions/index.js";
import { runNetworkCmd } from "./runNetwork.js";
import { testCmd } from "./runTests.js";
import { Octokit } from "@octokit/rest";
import { checkbox, confirm, input, select, Separator } from "@inquirer/prompts";

const octokit = new Octokit({
  baseUrl: "https://api.github.com",
  log: {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
  },
});

export async function main() {
  for (;;) {
    const globalConfig = (await configExists()) ? await importAsyncConfig() : undefined;
    clear();
    await printIntro();
    if (await mainMenu(globalConfig)) {
      break;
    }
  }

  process.stdout.write("Goodbye! 👋\n");
}

async function mainMenu(config?: MoonwallConfig) {
  const configPresent = config !== undefined;

  const menuChoice = await select({
    message: "Main Menu - Please select one of the following:",
    default: "init",
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
            name: "3) Quit Application",
            value: "quit",
          },
        ]
      : [
          {
            name: "1) Execute Script:                     Run scripts placed in your config defined script directory",
            value: "exec",
          },
          {
            name: "2) Network Launcher & Toolbox:         Launch network, access tools: tail logs, interactive tests etc",
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
            name: "5) Rename TestIDs:                     Rename test id prefixes based on position in the directory tree",
            value: "derive",
          },

          {
            name: "6) Quit Application",
            value: "quit",
          },
        ],
  });

  switch (menuChoice) {
    case "init":
      await generateConfig({});
      await createFolders();
      return false;
    case "run": {
      if (!config) {
        throw new Error("Config not defined, this is a defect please raise it.");
      }

      const chosenRunEnv = await chooseRunEnv(config);
      process.env.MOON_RUN_SCRIPTS = "true";
      if (chosenRunEnv.envName !== "back") {
        await runNetworkCmd(chosenRunEnv);
      }
      return true;
    }
    case "test": {
      if (!config) {
        throw new Error("Config not defined, this is a defect please raise it.");
      }

      const chosenTestEnv = await chooseTestEnv(config);
      if (chosenTestEnv.envName !== "back") {
        process.env.MOON_RUN_SCRIPTS = "true";
        await testCmd(chosenTestEnv.envName);

        await input({
          message: `ℹ️  Test run for ${chalk.bgWhiteBright.black(
            chosenTestEnv.envName
          )} has been completed. Press any key to continue...\n`,
        });
      }
      return true;
    }
    case "download":
      await resolveDownloadChoice();
      return false;

    case "quit":
      return await resolveQuitChoice();

    case "exec": {
      if (!config) {
        throw new Error("Config not defined, this is a defect please raise it.");
      }
      return await resolveExecChoice(config);
    }

    case "derive": {
      clear();
      const rootDir = await input({
        message: "Enter the root testSuites directory to process:",
        default: "suites",
      });
      await deriveTestIds({ rootDir });

      await input({
        message: `ℹ️  Renaming task for ${chalk.bold(
          `/${rootDir}`
        )} has been completed. Press any key to continue...\n`,
      });

      return false;
    }

    default:
      throw new Error("Invalid choice");
  }
}

async function resolveExecChoice(config: MoonwallConfig) {
  const scriptDir = config.scriptsDir;

  if (!scriptDir) {
    await input({
      message: `ℹ️  No scriptDir property defined at ${chalk.bgWhiteBright.black(
        "moonwall.config.json"
      )}\n Press any key to continue...\n`,
    });
    return false;
  }

  if (!fs.existsSync(scriptDir)) {
    await input({
      message: `ℹ️  No scriptDir found at at ${chalk.bgWhiteBright.black(
        path.join(process.cwd(), scriptDir)
      )}\n Press any key to continue...\n`,
    });
    return false;
  }

  const files = await fs.promises.readdir(scriptDir);

  if (!files) {
    await input({
      message: `ℹ️  No scripts found at ${chalk.bgWhiteBright.black(
        path.join(process.cwd(), config.scriptsDir || "")
      )}\n Press any key to continue...\n`,
    });
  }

  const choices = files.map((file) => {
    const ext = getExtString(file);
    return { name: `${ext}:    ${path.basename(file, "")}`, value: file };
  });

  for (;;) {
    const selections = await checkbox({
      message: "Select which scripts you'd like to run (press ↩️ with none selected to go 🔙)\n",
      choices,
    });

    if (selections.length === 0) {
      const noneSelected = await confirm({
        message: "No scripts have been selected to run, do you wish to exit?",
        default: true,
      });

      if (noneSelected) {
        return false;
      }
      continue;
    }

    for (const script of selections) {
      const args = await input({
        message: `Enter any arguments for ${chalk.bgWhiteBright.black(
          script
        )} (press enter for none)`,
      });

      await executeScript(script, args);
    }

    await input({
      message: "Press any key to continue...\n",
    });
    return false;
  }
}

async function resolveDownloadChoice() {
  const repos = (await configExists()) ? await allReposAsync() : standardRepos();
  const binList = repos.reduce((acc, curr) => {
    acc.push(...curr.binaries.flatMap((bin) => bin.name));
    acc.push(new Separator());
    acc.push("Back");
    acc.push(new Separator());
    return acc;
  }, [] as any[]);

  for (;;) {
    const firstChoice = await select({
      message: "Download - which artifact?",
      choices: binList,
    });
    if (firstChoice === "Back") {
      return;
    }

    const versions = await getVersions(
      firstChoice as string,
      (firstChoice as string).includes("runtime")
    );

    const chooseversion = await select({
      default: "latest",
      message: "Download - which version?",
      choices: [...versions, new Separator(), "Back", new Separator()],
    });

    if (chooseversion === "Back") {
      continue;
    }
    const chooseLocation = await input({
      message: "Download - where would you like it placed?",
      default: "./tmp",
    });

    const result = await confirm({
      message: `You are about to download ${chalk.bgWhite.blackBright(
        firstChoice
      )} v-${chalk.bgWhite.blackBright(chooseversion)} to: ${chalk.bgWhite.blackBright(
        chooseLocation
      )}.\n Would you like to continue? `,
      default: true,
    });

    if (result === false) {
      continue;
    }

    await fetchArtifact({
      bin: firstChoice as string,
      ver: chooseversion as string,
      path: chooseLocation as string,
    });
    return;
  }
}

const chooseTestEnv = async (config: MoonwallConfig) => {
  const envs = config.environments
    .map((a) => ({
      name: `[${a.foundation.type}] ${a.name}${a.description ? `: \t\t${a.description}` : ""}`,
      value: a.name,
      disabled: false,
    }))
    .sort((a, b) => (a.name > b.name ? -1 : +1));
  envs.push(...([new Separator(), { name: "Back", value: "back" }, new Separator()] as any));
  const envName = (await select({
    message: "Select a environment to run",
    pageSize: 12,
    choices: envs,
  })) as string;

  return { envName };
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
        a.description ? `: \t\t${a.description}` : ""
      }`;
    } else {
      result.name = chalk.dim(`[${a.foundation.type}] ${a.name}     NO NETWORK TO RUN`);
      result.disabled = true;
    }
    return result;
  });

  const choices = [
    ...envs.filter(({ disabled }) => disabled === false).sort((a, b) => (a.name > b.name ? 1 : -1)),
    new Separator(),
    ...envs.filter(({ disabled }) => disabled === true).sort((a, b) => (a.name > b.name ? 1 : -1)),
    new Separator(),
    { name: "Back", value: "back" },
    new Separator(),
  ];

  const envName = (await select({
    message: "Select a environment to run",
    pageSize: 12,
    choices,
  })) as string;

  return { envName };
};

const resolveQuitChoice = async () => {
  const result = await confirm({
    message: "Are you sure you want to Quit?",
    default: false,
  });
  return result;
};

const printIntro = async () => {
  const currentVersion = new SemVer(pkg.version);

  let remoteVersion = "";
  try {
    const releases = await octokit.rest.repos.listReleases({
      owner: "moonsong-labs",
      repo: "moonwall",
    });

    if (releases.status !== 200 || releases.data.length === 0) {
      throw new Error("No releases found for moonsong-labs.moonwall, try again later.");
    }
    const json = releases.data;

    remoteVersion =
      json.find((a) => a.tag_name.includes("moonwall@"))?.tag_name.split("@")[2] || "unknown";
  } catch (error) {
    remoteVersion = "unknown";
    console.error(`Fetch Error: ${error}`);
  }

  cfonts.say("Moonwall", {
    gradient: ["#FF66FF", "#9966FF", "#99CCFF", "#99FFFF", "#33FFFF", "#3366FF"],
    transitionGradient: true,
    lineHeight: 4,
  });

  const versionText =
    remoteVersion !== "unknown" && lt(currentVersion, new SemVer(remoteVersion))
      ? `V${currentVersion.version} (New version ${remoteVersion} available!) ${currentVersion.version}`
      : `V${currentVersion.version}`;

  const dividerLength = 90;
  const leftPadding = Math.floor((dividerLength - versionText.length) / 2);
  const rightPadding = dividerLength - versionText.length - leftPadding;

  const formattedDivider = `${colors.rainbow("=".repeat(leftPadding))}${chalk.bgCyan.grey(versionText)}${colors.rainbow("=".repeat(rightPadding))}\n`;

  console.log(formattedDivider);
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
