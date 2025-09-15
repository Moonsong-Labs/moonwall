// src/internal/cmdFunctions/downloader.ts
import { SingleBar, Presets } from "cli-progress";
import fs from "fs";
import { Readable } from "stream";
async function downloader(url, outputPath) {
  const tempPath = `${outputPath}.tmp`;
  const writeStream = fs.createWriteStream(tempPath);
  let transferredBytes = 0;
  if (url.startsWith("ws")) {
    console.log("You've passed a WebSocket URL to fetch. Is this intended?");
  }
  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.body) {
    throw new Error("No response body");
  }
  const readStream = Readable.fromWeb(response.body);
  const contentLength = Number.parseInt(response.headers.get("Content-Length") || "0");
  const progressBar = initializeProgressBar();
  progressBar.start(contentLength, 0);
  readStream.pipe(writeStream);
  await new Promise((resolve, reject) => {
    readStream.on("data", (chunk) => {
      transferredBytes += chunk.length;
      progressBar.update(transferredBytes);
    });
    readStream.on("end", () => {
      writeStream.end();
      progressBar.stop();
      process.stdout.write("  \u{1F4BE} Saving binary artifact...");
      writeStream.close(() => resolve());
    });
    readStream.on("error", (error) => {
      reject(error);
    });
  });
  fs.writeFileSync(outputPath, fs.readFileSync(tempPath));
  fs.rmSync(tempPath);
}
function initializeProgressBar() {
  const options = {
    etaAsynchronousUpdate: true,
    etaBuffer: 40,
    format: "Downloading: [{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total}",
  };
  return new SingleBar(options, Presets.shades_classic);
}

// src/internal/cmdFunctions/fetchArtifact.ts
import fs2 from "fs/promises";
import path2 from "path";
import semver from "semver";
import chalk from "chalk";

// src/internal/processHelpers.ts
import child_process from "child_process";
import { promisify } from "util";
import { createLogger } from "@moonwall/util";
var logger = createLogger({ name: "actions:runner" });
var debug = logger.debug.bind(logger);
var execAsync = promisify(child_process.exec);
async function runTask(
  cmd,
  { cwd, env } = {
    cwd: process.cwd(),
  },
  title
) {
  debug(`${
    title
      ? `Title: ${title}
`
      : ""
  }Running task on directory ${cwd}: ${cmd}
`);
  try {
    const result = await execAsync(cmd, { cwd, env });
    return result.stdout;
  } catch (error) {
    const status = error.status ? `[${error.status}]` : "[Unknown Status]";
    const message = error.message ? `${error.message}` : "No Error Message";
    debug(`Caught exception in command execution. Error[${status}] ${message}`);
    throw error;
  }
}

// src/internal/cmdFunctions/fetchArtifact.ts
import { minimatch } from "minimatch";

// src/lib/repoDefinitions/moonbeam.ts
var repo = {
  name: "moonbeam",
  binaries: [
    {
      name: "moonbeam",
      defaultArgs: [
        "--no-hardware-benchmarks",
        "--no-telemetry",
        "--reserved-only",
        "--rpc-cors=all",
        "--unsafe-rpc-external",
        "--unsafe-force-node-key-generation",
        "--no-grandpa",
        "--sealing=manual",
        "--force-authoring",
        "--no-prometheus",
        "--alice",
        "--chain=moonbase-dev",
        "--tmp",
      ],
    },
    { name: "moonbase-runtime" },
    { name: "moonbeam-runtime" },
    { name: "moonriver-runtime" },
  ],
  ghAuthor: "moonbeam-foundation",
  ghRepo: "moonbeam",
};
var moonbeam_default = repo;

// src/lib/repoDefinitions/polkadot.ts
var repo2 = {
  name: "polkadot",
  binaries: [
    { name: "polkadot" },
    { name: "polkadot-prepare-worker" },
    { name: "polkadot-execute-worker" },
  ],
  ghAuthor: "paritytech",
  ghRepo: "polkadot-sdk",
};
var polkadot_default = repo2;

// src/lib/repoDefinitions/tanssi.ts
var repo3 = {
  name: "tanssi",
  binaries: [
    {
      name: "tanssi-node",
      defaultArgs: ["--dev", "--sealing=manual", "--no-hardware-benchmarks"],
    },
    { name: "container-chain-template-simple-node" },
    { name: "container-chain-template-frontier-node" },
  ],
  ghAuthor: "moondance-labs",
  ghRepo: "tanssi",
};
var tanssi_default = repo3;

// src/lib/configReader.ts
import "@moonbeam-network/api-augment";
import { readFile, access } from "fs/promises";
import { readFileSync, existsSync, constants } from "fs";
import JSONC from "jsonc-parser";
import path, { extname } from "path";
var cachedConfig;
async function configExists() {
  try {
    await access(process.env.MOON_CONFIG_PATH || "", constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
async function parseConfig(filePath) {
  let result;
  const file = await readFile(filePath, "utf8");
  switch (extname(filePath)) {
    case ".json":
      result = JSON.parse(file);
      break;
    case ".config":
      result = JSONC.parse(file);
      break;
    default:
      result = void 0;
      break;
  }
  return result;
}
async function importAsyncConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const configPath = process.env.MOON_CONFIG_PATH;
  if (!configPath) {
    throw new Error("No moonwall config path set. This is a defect, please raise it.");
  }
  const filePath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  try {
    const config = await parseConfig(filePath);
    const replacedConfig = replaceEnvVars(config);
    cachedConfig = replacedConfig;
    return cachedConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`);
  }
}
function replaceEnvVars(value) {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (match, group) => {
      const envVarValue = process.env[group];
      return envVarValue || match;
    });
  }
  if (Array.isArray(value)) {
    return value.map(replaceEnvVars);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceEnvVars(v)]));
  }
  return value;
}

// src/lib/repoDefinitions/index.ts
async function allReposAsync() {
  const defaultRepos = [moonbeam_default, polkadot_default, tanssi_default];
  const globalConfig = await importAsyncConfig();
  const importedRepos = globalConfig.additionalRepos || [];
  return [...defaultRepos, ...importedRepos];
}
function standardRepos() {
  const defaultRepos = [moonbeam_default, polkadot_default, tanssi_default];
  return [...defaultRepos];
}

// src/internal/cmdFunctions/fetchArtifact.ts
import { execSync } from "child_process";
import { Octokit } from "@octokit/rest";
import { confirm } from "@inquirer/prompts";
var octokit = new Octokit({
  baseUrl: "https://api.github.com",
  log: {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
  },
});
async function fetchArtifact(args) {
  if (args.path && (await fs2.access(args.path).catch(() => true))) {
    console.log("Folder not exists, creating");
    fs2.mkdir(args.path);
  }
  const checkOverwrite = async (path4) => {
    try {
      await fs2.access(path4, fs2.constants.R_OK);
      if (args.overwrite) {
        console.log("File exists, overwriting ...");
      } else {
        const cont = await confirm({
          message: "File exists, do you want to overwrite?",
        });
        if (!cont) {
          return false;
        }
      }
    } catch {
      console.log("File does not exist, creating ...");
    }
    return true;
  };
  const binary = args.bin;
  const repos = (await configExists()) ? await allReposAsync() : standardRepos();
  const repo4 = repos.find((network) => network.binaries.find((bin) => bin.name === binary));
  if (!repo4) {
    throw new Error(`Downloading ${binary} unsupported`);
  }
  const enteredPath = args.path ? args.path : "tmp/";
  const releases = await octokit.rest.repos.listReleases({
    owner: repo4.ghAuthor,
    repo: repo4.ghRepo,
  });
  if (releases.status !== 200 || releases.data.length === 0) {
    throw new Error(`No releases found for ${repo4.ghAuthor}.${repo4.ghRepo}, try again later.`);
  }
  const release = binary.includes("-runtime")
    ? releases.data.find((release2) => {
        if (args.ver === "latest") {
          return release2.assets.find((asset2) => asset2.name.includes(binary));
        }
        return release2.assets.find((asset2) => asset2.name === `${binary}-${args.ver}.wasm`);
      })
    : args.ver === "latest"
      ? releases.data.find((release2) => release2.assets.find((asset2) => asset2.name === binary))
      : releases.data
          .filter((release2) => release2.tag_name.includes(args.ver || ""))
          .find((release2) => release2.assets.find((asset2) => minimatch(asset2.name, binary)));
  if (!release) {
    throw new Error(`Release not found for ${args.ver}`);
  }
  const asset = binary.includes("-runtime")
    ? release.assets.find((asset2) => asset2.name.includes(binary) && asset2.name.includes("wasm"))
    : release.assets.find((asset2) => minimatch(asset2.name, binary));
  if (!asset) {
    throw new Error(`Asset not found for ${binary}`);
  }
  if (!binary.includes("-runtime")) {
    const url = asset.browser_download_url;
    const filename = path2.basename(url);
    const binPath = args.outputName ? args.outputName : path2.join("./", enteredPath, filename);
    if ((await checkOverwrite(binPath)) === false) {
      console.log("User chose not to overwrite existing file, exiting.");
      return;
    }
    await downloader(url, binPath);
    await fs2.chmod(binPath, "755");
    if (filename.endsWith(".tar.gz")) {
      const outputBuffer = execSync(`tar -xzvf ${binPath}`);
      const cleaned = outputBuffer.toString().split("\n")[0].split("/")[0];
      const version2 = (await runTask(`./${cleaned} --version`)).trim();
      process.stdout.write(` ${chalk.green(version2.trim())} \u2713
`);
      return;
    }
    const version = (await runTask(`./${binPath} --version`)).trim();
    process.stdout.write(`${path2.basename(binPath)} ${chalk.green(version.trim())} \u2713
`);
    return;
  }
  const binaryPath = args.outputName
    ? args.outputName
    : path2.join("./", args.path || "", `${args.bin}-${args.ver}.wasm`);
  if ((await checkOverwrite(binaryPath)) === false) {
    console.log("User chose not to overwrite existing file, exiting.");
    return;
  }
  await downloader(asset.browser_download_url, binaryPath);
  await fs2.chmod(binaryPath, "755");
  process.stdout.write(` ${chalk.green("done")} \u2713
`);
  return;
}
async function getVersions(name, runtime = false) {
  const repos = (await configExists()) ? await allReposAsync() : standardRepos();
  const repo4 = repos.find((network) => network.binaries.find((bin) => bin.name === name));
  if (!repo4) {
    throw new Error(`Network not found for ${name}`);
  }
  const releases = await octokit.rest.repos.listReleases({
    owner: repo4.ghAuthor,
    repo: repo4.ghRepo,
  });
  if (releases.status !== 200 || releases.data.length === 0) {
    throw new Error(`No releases found for ${repo4.ghAuthor}.${repo4.ghRepo}, try again later.`);
  }
  const versions = releases.data
    .map((release) => {
      let tag = release.tag_name;
      if (release.tag_name.includes("v")) {
        tag = tag.split("v")[1];
      }
      if (tag.includes("-rc")) {
        tag = tag.split("-rc")[0];
      }
      return tag;
    })
    .filter(
      (version) =>
        (runtime && version.includes("runtime")) || (!runtime && !version.includes("runtime"))
    )
    .map((version) => version.replace("runtime-", ""));
  const set = new Set(versions);
  return runtime
    ? [...set]
    : [...set].sort((a, b) => (semver.valid(a) && semver.valid(b) ? semver.rcompare(a, b) : a));
}

// src/internal/cmdFunctions/initialisation.ts
import fs3 from "fs/promises";
import { input, number, confirm as confirm2 } from "@inquirer/prompts";
async function createFolders() {
  await fs3.mkdir("scripts").catch(() => "scripts folder already exists, skipping");
  await fs3.mkdir("tests").catch(() => "tests folder already exists, skipping");
  await fs3.mkdir("tmp").catch(() => "tmp folder already exists, skipping");
}
async function generateConfig(argv) {
  let answers;
  try {
    await fs3.access("moonwall.config.json");
    console.log("\u2139\uFE0F  Config file already exists at this location. Quitting.");
    return;
  } catch (_) {}
  if (argv.acceptAllDefaults) {
    answers = {
      label: "moonwall_config",
      timeout: 3e4,
      environmentName: "default_env",
      foundation: "dev",
      testDir: "tests/default/",
    };
  } else {
    while (true) {
      answers = {
        label: await input({
          message: "Provide a label for the config file",
          default: "moonwall_config",
        }),
        timeout:
          (await number({
            message: "Provide a global timeout value",
            default: 3e4,
          })) ?? 3e4,
        environmentName: await input({
          message: "Provide a name for this environment",
          default: "default_env",
        }),
        foundation: "dev",
        testDir: await input({
          message: "Provide the path for where tests for this environment are kept",
          default: "tests/default/",
        }),
      };
      const proceed = await confirm2({
        message: "Would you like to generate this config? (no to restart from beginning)",
      });
      if (proceed) {
        break;
      }
      console.log("Restarting the configuration process...");
    }
  }
  const config = createSampleConfig({
    label: answers.label,
    timeout: answers.timeout,
    environmentName: answers.environmentName,
    foundation: answers.foundation,
    testDir: answers.testDir,
  });
  const JSONBlob = JSON.stringify(config, null, 3);
  await fs3.writeFile("moonwall.config.json", JSONBlob, "utf-8");
  process.env.MOON_CONFIG_PATH = "./moonwall.config.json";
  await createSampleTest(answers.testDir);
  console.log("Test directory created at: ", answers.testDir);
  console.log(
    `You can now add tests to this directory and run them with 'pnpm moonwall test ${answers.environmentName}'`
  );
  console.log("Goodbye! \u{1F44B}");
}
function createConfig(options) {
  return {
    label: options.label,
    defaultTestTimeout: options.timeout,
    environments: [
      {
        name: options.environmentName,
        testFileDir: [options.testDir],
        foundation: {
          type: options.foundation,
        },
      },
    ],
  };
}
function createSampleConfig(options) {
  return {
    $schema:
      "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/packages/types/config_schema.json",
    label: options.label,
    defaultTestTimeout: options.timeout,
    environments: [
      {
        name: options.environmentName,
        testFileDir: [options.testDir],
        multiThreads: false,
        foundation: {
          type: "dev",
          launchSpec: [
            {
              name: "moonbeam",
              useDocker: true,
              newRpcBehaviour: true,
              binPath: "moonbeamfoundation/moonbeam",
            },
          ],
        },
      },
    ],
  };
}
async function createSampleTest(directory) {
  await fs3.mkdir(directory, { recursive: true });
  await fs3.writeFile(`${directory}/sample.test.ts`, sampleTest, "utf-8");
}
var sampleTest = `import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "B01",
  title: "Sample test suite for moonbeam network",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {

    const ALITH_ADDRESS = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

    it({
      id: "T01",
      title: "Test that API is connected correctly",
      test: async () => {
        const chainName = context.pjsApi.consts.system.version.specName.toString();
        const specVersion = context.pjsApi.consts.system.version.specVersion.toNumber();
        expect(chainName.length).toBeGreaterThan(0)
        expect(chainName).toBe("moonbase")
        expect(specVersion).toBeGreaterThan(0)
      },
    });

    it({
      id: "T02",
      title: "Test that chain queries can be made",
      test: async () => {
        const balance = (await context.pjsApi.query.system.account(ALITH_ADDRESS)).data.free
        expect(balance.toBigInt()).toBeGreaterThan(0n)
      },
    });

  },
});

`;

// src/internal/cmdFunctions/tempLogs.ts
import path3 from "path";
import fs4 from "fs";
function clearNodeLogs(silent = true) {
  const dirPath = path3.join(process.cwd(), "tmp", "node_logs");
  if (!fs4.existsSync(dirPath)) {
    fs4.mkdirSync(dirPath, { recursive: true });
  }
  const files = fs4.readdirSync(dirPath);
  for (const file of files) {
    !silent && console.log(`Deleting log: ${file}`);
    if (file.endsWith(".log")) {
      fs4.unlinkSync(path3.join(dirPath, file));
    }
  }
}
function reportLogLocation(silent = false) {
  const dirPath = path3.join(process.cwd(), "tmp", "node_logs");
  if (!fs4.existsSync(dirPath)) {
    fs4.mkdirSync(dirPath, { recursive: true });
  }
  const result = fs4.readdirSync(dirPath);
  let consoleMessage = "";
  let filePath = "";
  try {
    filePath = process.env.MOON_ZOMBIE_DIR
      ? process.env.MOON_ZOMBIE_DIR
      : process.env.MOON_LOG_LOCATION
        ? process.env.MOON_LOG_LOCATION
        : path3.join(
            dirPath,
            result.find((file) => path3.extname(file) === ".log") || "no_logs_found"
          );
    consoleMessage = `  \u{1FAB5}   Log location: ${filePath}`;
  } catch (e) {
    console.error(e);
  }
  !silent && console.log(consoleMessage);
  return filePath.trim();
}
export {
  clearNodeLogs,
  createConfig,
  createFolders,
  createSampleConfig,
  downloader,
  fetchArtifact,
  generateConfig,
  getVersions,
  initializeProgressBar,
  reportLogLocation,
};
