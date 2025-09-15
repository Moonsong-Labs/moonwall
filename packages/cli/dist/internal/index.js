var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) =>
  function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res;
  };
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/configReader.ts
var configReader_exports = {};
__export(configReader_exports, {
  cacheConfig: () => cacheConfig,
  configExists: () => configExists,
  configSetup: () => configSetup,
  getEnvironmentFromConfig: () => getEnvironmentFromConfig,
  importAsyncConfig: () => importAsyncConfig,
  importConfig: () => importConfig,
  importJsonConfig: () => importJsonConfig,
  isEthereumDevConfig: () => isEthereumDevConfig,
  isEthereumZombieConfig: () => isEthereumZombieConfig,
  isOptionSet: () => isOptionSet,
  loadEnvVars: () => loadEnvVars,
  parseZombieConfigForBins: () => parseZombieConfigForBins,
});
import "@moonbeam-network/api-augment";
import { readFile, access } from "fs/promises";
import { readFileSync, existsSync, constants } from "fs";
import JSONC from "jsonc-parser";
import path, { extname } from "path";
async function configExists() {
  try {
    await access(process.env.MOON_CONFIG_PATH || "", constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
function configSetup(args) {
  if (args.includes("--configFile") || process.argv.includes("-c")) {
    const index =
      process.argv.indexOf("--configFile") !== -1
        ? process.argv.indexOf("--configFile")
        : process.argv.indexOf("-c") !== -1
          ? process.argv.indexOf("-c")
          : 0;
    if (index === 0) {
      throw new Error("Invalid configFile argument");
    }
    const configFile = process.argv[index + 1];
    if (!existsSync(configFile)) {
      throw new Error(`Config file not found at "${configFile}"`);
    }
    process.env.MOON_CONFIG_PATH = configFile;
  }
  if (!process.env.MOON_CONFIG_PATH) {
    process.env.MOON_CONFIG_PATH = "moonwall.config.json";
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
function parseConfigSync(filePath) {
  let result;
  const file = readFileSync(filePath, "utf8");
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
async function importConfig(configPath) {
  return await import(configPath);
}
function isOptionSet(option) {
  const env = getEnvironmentFromConfig();
  const optionValue = traverseConfig(env, option);
  return optionValue !== void 0;
}
function isEthereumZombieConfig() {
  const config = importJsonConfig();
  const env = getEnvironmentFromConfig();
  return env.foundation.type === "zombie" && !env.foundation.zombieSpec.disableDefaultEthProviders;
}
function isEthereumDevConfig() {
  const config = importJsonConfig();
  const env = getEnvironmentFromConfig();
  return env.foundation.type === "dev" && !env.foundation.launchSpec[0].disableDefaultEthProviders;
}
async function cacheConfig() {
  const configPath = process.env.MOON_CONFIG_PATH;
  if (!configPath) {
    throw new Error(`Environment ${process.env.MOON_TEST_ENV} not found in config`);
  }
  const filePath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  try {
    const config = parseConfigSync(filePath);
    const replacedConfig = replaceEnvVars(config);
    cachedConfig = replacedConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`);
  }
}
function getEnvironmentFromConfig() {
  const globalConfig = importJsonConfig();
  const config = globalConfig.environments.find(({ name }) => name === process.env.MOON_TEST_ENV);
  if (!config) {
    throw new Error(`Environment ${process.env.MOON_TEST_ENV} not found in config`);
  }
  return config;
}
function importJsonConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const configPath = process.env.MOON_CONFIG_PATH;
  if (!configPath) {
    throw new Error("No moonwall config path set. This is a defect, please raise it.");
  }
  const filePath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  try {
    const config = parseConfigSync(filePath);
    const replacedConfig = replaceEnvVars(config);
    cachedConfig = replacedConfig;
    return cachedConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`);
  }
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
function loadEnvVars() {
  const env = getEnvironmentFromConfig();
  for (const envVar of env.envVars || []) {
    const [key, value] = envVar.split("=");
    process.env[key] = value;
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
function traverseConfig(configObj, option) {
  if (typeof configObj !== "object" || !configObj) return void 0;
  if (Object.prototype.hasOwnProperty.call(configObj, option)) {
    return configObj[option];
  }
  for (const key in configObj) {
    const result = traverseConfig(configObj[key], option);
    if (result !== void 0) {
      return result;
    }
  }
  return void 0;
}
function parseZombieConfigForBins(zombieConfigPath) {
  const config = JSON.parse(readFileSync(zombieConfigPath, "utf8"));
  const commands = [];
  if (config.relaychain?.default_command) {
    commands.push(path.basename(config.relaychain.default_command));
  }
  if (config.parachains) {
    for (const parachain of config.parachains) {
      if (parachain.collator?.command) {
        commands.push(path.basename(parachain.collator.command));
      }
    }
  }
  return [...new Set(commands)].sort();
}
var cachedConfig;
var init_configReader = __esm({
  "src/lib/configReader.ts"() {
    "use strict";
  },
});

// src/internal/logging.ts
var originalWrite = process.stderr.write.bind(process.stderr);
var blockList = [
  "has multiple versions, ensure that there is only one installed",
  "Unable to map [u8; 32] to a lookup index",
];
process.stderr.write = (chunk, encodingOrCallback, callback) => {
  let shouldWrite = true;
  if (typeof chunk === "string") {
    shouldWrite = !blockList.some((phrase) => chunk.includes(phrase));
  }
  if (shouldWrite) {
    if (typeof encodingOrCallback === "function") {
      return originalWrite.call(process.stderr, chunk, void 0, encodingOrCallback);
    }
    return originalWrite.call(process.stderr, chunk, encodingOrCallback, callback);
  }
  const cb = typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
  if (cb) cb(null);
  return true;
};

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
var withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Operation timed out")), ms)),
  ]);
};
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
async function spawnTask(
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
  }Running task on directory ${process.cwd()}: ${cmd}
`);
  try {
    const process2 = child_process.spawn(
      cmd.split(" ")[0],
      cmd
        .split(" ")
        .slice(1)
        .filter((a) => a.length > 0),
      {
        cwd,
        env,
      }
    );
    return process2;
  } catch (error) {
    const status = error.status ? `[${error.status}]` : "[Unknown Status]";
    const message = error.message ? `${error.message}` : "No Error Message";
    debug(`Caught exception in command execution. Error[${status}] ${message}
`);
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

// src/lib/repoDefinitions/index.ts
init_configReader();
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
init_configReader();
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
  const checkOverwrite = async (path10) => {
    try {
      await fs2.access(path10, fs2.constants.R_OK);
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

// src/internal/commandParsers.ts
import chalk2 from "chalk";
import path4 from "path";
import net from "net";
import invariant from "tiny-invariant";
function parseZombieCmd(launchSpec) {
  if (launchSpec) {
    return { cmd: launchSpec.configPath };
  }
  throw new Error(
    `No ZombieSpec found in config. 
 Are you sure your ${chalk2.bgWhiteBright.blackBright(
   "moonwall.config.json"
 )} file has the correct "configPath" in zombieSpec?`
  );
}
function fetchDefaultArgs(binName, additionalRepos = []) {
  let defaultArgs;
  const repos = [...standardRepos(), ...additionalRepos];
  for (const repo4 of repos) {
    const foundBin = repo4.binaries.find((bin) => bin.name === binName);
    if (foundBin) {
      defaultArgs = foundBin.defaultArgs;
      break;
    }
  }
  if (!defaultArgs) {
    defaultArgs = ["--dev"];
  }
  return defaultArgs;
}
var LaunchCommandParser = class _LaunchCommandParser {
  args;
  cmd;
  launch;
  launchSpec;
  additionalRepos;
  launchOverrides;
  constructor(options) {
    const { launchSpec, additionalRepos, launchOverrides } = options;
    this.launchSpec = launchSpec;
    this.additionalRepos = additionalRepos;
    this.launchOverrides = launchOverrides;
    this.launch = !launchSpec.running ? true : launchSpec.running;
    this.cmd = launchSpec.binPath;
    this.args = launchSpec.options
      ? [...launchSpec.options]
      : fetchDefaultArgs(path4.basename(launchSpec.binPath), additionalRepos);
  }
  overrideArg(newArg) {
    const newArgKey = newArg.split("=")[0];
    const existingIndex = this.args.findIndex((arg) => arg.startsWith(`${newArgKey}=`));
    if (existingIndex !== -1) {
      this.args[existingIndex] = newArg;
    } else {
      this.args.push(newArg);
    }
  }
  async withPorts() {
    if (this.launchSpec.ports) {
      const ports = this.launchSpec.ports;
      if (ports.p2pPort) {
        this.overrideArg(`--port=${ports.p2pPort}`);
      }
      if (ports.wsPort) {
        this.overrideArg(`--ws-port=${ports.wsPort}`);
      }
      if (ports.rpcPort) {
        this.overrideArg(`--rpc-port=${ports.rpcPort}`);
      }
    } else {
      const freePort = (await getFreePort()).toString();
      process.env.MOONWALL_RPC_PORT = freePort;
      if (this.launchSpec.newRpcBehaviour) {
        this.overrideArg(`--rpc-port=${freePort}`);
      } else {
        this.overrideArg(`--ws-port=${freePort}`);
      }
    }
    return this;
  }
  withDefaultForkConfig() {
    const forkOptions = this.launchSpec.defaultForkConfig;
    if (forkOptions) {
      this.applyForkOptions(forkOptions);
    }
    return this;
  }
  withLaunchOverrides() {
    if (this.launchOverrides?.forkConfig) {
      this.applyForkOptions(this.launchOverrides.forkConfig);
    }
    return this;
  }
  print() {
    console.log(chalk2.cyan(`Command to run is: ${chalk2.bold(this.cmd)}`));
    console.log(chalk2.cyan(`Arguments are: ${chalk2.bold(this.args.join(" "))}`));
    return this;
  }
  applyForkOptions(forkOptions) {
    if (forkOptions.url) {
      invariant(forkOptions.url.startsWith("http"), "Fork URL must start with http:// or https://");
      this.overrideArg(`--fork-chain-from-rpc=${forkOptions.url}`);
    }
    if (forkOptions.blockHash) {
      this.overrideArg(`--block=${forkOptions.blockHash}`);
    }
    if (forkOptions.stateOverridePath) {
      this.overrideArg(`--fork-state-overrides=${forkOptions.stateOverridePath}`);
    }
    if (forkOptions.verbose) {
      this.overrideArg("-llazy-loading=trace");
    }
  }
  build() {
    return {
      cmd: this.cmd,
      args: this.args,
      launch: this.launch,
    };
  }
  static async create(options) {
    const parser = new _LaunchCommandParser(options);
    const parsed = await parser
      .withPorts()
      .then((p) => p.withDefaultForkConfig().withLaunchOverrides());
    if (options.verbose) {
      parsed.print();
    }
    return parsed.build();
  }
};
function parseChopsticksRunCmd(launchSpecs) {
  const launch = !launchSpecs[0].running ? true : launchSpecs[0].running;
  if (launchSpecs.length === 1) {
    const chopsticksCmd2 = "node";
    const chopsticksArgs2 = [
      "node_modules/@acala-network/chopsticks/chopsticks.cjs",
      `--config=${launchSpecs[0].configPath}`,
      `--addr=${launchSpecs[0].address ?? "127.0.0.1"}`,
      // use old behaviour by default
    ];
    const mode = launchSpecs[0].buildBlockMode ? launchSpecs[0].buildBlockMode : "manual";
    const num = mode === "batch" ? "Batch" : mode === "instant" ? "Instant" : "Manual";
    chopsticksArgs2.push(`--build-block-mode=${num}`);
    if (launchSpecs[0].wsPort) {
      chopsticksArgs2.push(`--port=${launchSpecs[0].wsPort}`);
    }
    if (launchSpecs[0].wasmOverride) {
      chopsticksArgs2.push(`--wasm-override=${launchSpecs[0].wasmOverride}`);
    }
    if (launchSpecs[0].allowUnresolvedImports) {
      chopsticksArgs2.push("--allow-unresolved-imports");
    }
    return {
      cmd: chopsticksCmd2,
      args: chopsticksArgs2,
      launch,
    };
  }
  const chopsticksCmd = "node";
  const chopsticksArgs = ["node_modules/@acala-network/chopsticks/chopsticks.cjs", "xcm"];
  for (const spec of launchSpecs) {
    const type = spec.type ? spec.type : "parachain";
    switch (type) {
      case "parachain":
        chopsticksArgs.push(`--parachain=${spec.configPath}`);
        break;
      case "relaychain":
        chopsticksArgs.push(`--relaychain=${spec.configPath}`);
    }
  }
  return {
    cmd: chopsticksCmd,
    args: chopsticksArgs,
    launch,
  };
}
var isPortAvailable = async (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once("close", () => resolve(true));
      server.close();
    });
    server.on("error", () => resolve(false));
  });
};
var getNextAvailablePort = async (startPort) => {
  let port = startPort;
  while (port <= 65535) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error(`No available ports found starting from ${startPort}`);
};
var getFreePort = async () => {
  let shardIndex = 0;
  let totalShards = 1;
  const testShard = process.env.MOONWALL_TEST_SHARD;
  if (testShard?.includes("/")) {
    const [current, total] = testShard.split("/");
    shardIndex = parseInt(current, 10) - 1;
    totalShards = parseInt(total, 10);
  }
  const poolId = parseInt(process.env.VITEST_POOL_ID || "0", 10);
  const basePort = 1e4;
  const shardOffset = shardIndex * 1e3;
  const poolOffset = poolId * 100;
  const processOffset = process.pid % 50;
  const calculatedPort = basePort + shardOffset + poolOffset + processOffset;
  const startPort = Math.min(calculatedPort, 6e4 + shardIndex * 100 + poolId);
  if (process.env.DEBUG_MOONWALL_PORTS) {
    console.log(
      `[DEBUG] Port calculation: shard=${shardIndex + 1}/${totalShards}, pool=${poolId}, final=${startPort}`
    );
  }
  return getNextAvailablePort(startPort);
};

// src/internal/deriveTestIds.ts
import chalk3 from "chalk";
import fs5 from "fs";
import { confirm as confirm3 } from "@inquirer/prompts";
import path5 from "path";
async function deriveTestIds(params) {
  const usedPrefixes = /* @__PURE__ */ new Set();
  const { rootDir, singlePrefix } = params;
  try {
    await fs5.promises.access(rootDir, fs5.constants.R_OK);
  } catch (error) {
    console.error(
      `\u{1F534} Error accessing directory ${chalk3.bold(`/${rootDir}`)}, please sure this exists`
    );
    process.exitCode = 1;
    return;
  }
  console.log(`\u{1F7E2} Processing ${rootDir} ...`);
  const topLevelDirs = getTopLevelDirs(rootDir);
  const foldersToRename = [];
  if (singlePrefix) {
    const prefix = generatePrefix(rootDir, usedPrefixes, params.prefixPhrase);
    foldersToRename.push({ prefix, dir: "." });
  } else {
    for (const dir of topLevelDirs) {
      const prefix = generatePrefix(dir, usedPrefixes, params.prefixPhrase);
      foldersToRename.push({ prefix, dir });
    }
  }
  const result = await confirm3({
    message: `This will rename ${foldersToRename.length} suites IDs in ${rootDir}, continue?`,
  });
  if (!result) {
    console.log("\u{1F534} Aborted");
    return;
  }
  for (const folder of foldersToRename) {
    const { prefix, dir } = folder;
    process.stdout.write(
      `\u{1F7E2} Changing suite ${dir} to use prefix ${chalk3.bold(`(${prefix})`)} ....`
    );
    generateId(path5.join(rootDir, dir), rootDir, prefix);
    process.stdout.write(" Done \u2705\n");
  }
  console.log(`\u{1F3C1} Finished renaming rootdir ${chalk3.bold(`/${rootDir}`)}`);
}
function getTopLevelDirs(rootDir) {
  return fs5
    .readdirSync(rootDir)
    .filter((dir) => fs5.statSync(path5.join(rootDir, dir)).isDirectory());
}
function generatePrefix(directory, usedPrefixes, rootPrefix) {
  const sanitizedDir = directory.replace(/[-_ ]/g, "").toUpperCase();
  let prefix = rootPrefix ?? sanitizedDir[0];
  let additionalIndex = 1;
  while (usedPrefixes.has(prefix) && additionalIndex < sanitizedDir.length) {
    prefix += rootPrefix?.[additionalIndex] ?? sanitizedDir[additionalIndex];
    additionalIndex++;
  }
  let numericSuffix = 0;
  while (usedPrefixes.has(prefix)) {
    if (numericSuffix < 10) {
      numericSuffix++;
      prefix = sanitizedDir[0] + numericSuffix.toString();
    } else {
      let lastChar = prefix.slice(-1).charCodeAt(0);
      if (lastChar >= 90) {
        lastChar = 65;
      } else {
        lastChar++;
      }
      prefix = sanitizedDir[0] + String.fromCharCode(lastChar);
    }
  }
  usedPrefixes.add(prefix);
  return prefix;
}
function generateId(directory, rootDir, prefix) {
  const contents = fs5.readdirSync(directory);
  contents.sort((a, b) => {
    const aIsDir = fs5.statSync(path5.join(directory, a)).isDirectory();
    const bIsDir = fs5.statSync(path5.join(directory, b)).isDirectory();
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return customFileSort(a, b);
  });
  let fileCount = 1;
  let subDirCount = 1;
  for (const item of contents) {
    const fullPath = path5.join(directory, item);
    if (fs5.statSync(fullPath).isDirectory()) {
      const subDirPrefix = `0${subDirCount}`.slice(-2);
      generateId(fullPath, rootDir, prefix + subDirPrefix);
      subDirCount++;
    } else {
      const fileContent = fs5.readFileSync(fullPath, "utf-8");
      if (fileContent.includes("describeSuite")) {
        const newId = prefix + `0${fileCount}`.slice(-2);
        const updatedContent = fileContent.replace(
          /(describeSuite\s*?\(\s*?\{\s*?id\s*?:\s*?['"])[^'"]+(['"])/,
          `$1${newId}$2`
        );
        fs5.writeFileSync(fullPath, updatedContent);
      }
      fileCount++;
    }
  }
}
function hasSpecialCharacters(filename) {
  return /[ \t!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(filename);
}
function customFileSort(a, b) {
  const aHasSpecialChars = hasSpecialCharacters(a);
  const bHasSpecialChars = hasSpecialCharacters(b);
  if (aHasSpecialChars && !bHasSpecialChars) return -1;
  if (!aHasSpecialChars && bHasSpecialChars) return 1;
  return a.localeCompare(b, void 0, { sensitivity: "accent" });
}

// src/internal/fileCheckers.ts
import fs6 from "fs";
import { execSync as execSync2 } from "child_process";
import chalk4 from "chalk";
import os from "os";
import path6 from "path";
import { select as select2 } from "@inquirer/prompts";
async function checkExists(path10) {
  const binPath = path10.split(" ")[0];
  const fsResult = fs6.existsSync(binPath);
  if (!fsResult) {
    throw new Error(
      `No binary file found at location: ${binPath} 
 Are you sure your ${chalk4.bgWhiteBright.blackBright(
   "moonwall.config.json"
 )} file has the correct "binPath" in launchSpec?`
    );
  }
  const binArch = await getBinaryArchitecture(binPath);
  const currentArch = os.arch();
  if (binArch !== currentArch && binArch !== "unknown") {
    throw new Error(
      `The binary architecture ${chalk4.bgWhiteBright.blackBright(
        binArch
      )} does not match this system's architecture ${chalk4.bgWhiteBright.blackBright(currentArch)}
Download or compile a new binary executable for ${chalk4.bgWhiteBright.blackBright(currentArch)} `
    );
  }
  return true;
}
async function downloadBinsIfMissing(binPath) {
  const binName = path6.basename(binPath);
  const binDir = path6.dirname(binPath);
  const binPathExists = fs6.existsSync(binPath);
  if (!binPathExists && process.arch === "x64") {
    const download = await select2({
      message: `The binary ${chalk4.bgBlack.greenBright(
        binName
      )} is missing from ${chalk4.bgBlack.greenBright(path6.join(process.cwd(), binDir))}.
Would you like to download it now?`,
      default: 0,
      choices: [
        { name: `Yes, download ${binName}`, value: true },
        { name: "No, quit program", value: false },
      ],
    });
    if (!download) {
      process.exit(0);
    } else {
      execSync2(`mkdir -p ${binDir}`);
      execSync2(`pnpm moonwall download ${binName} latest ${binDir}`, {
        stdio: "inherit",
      });
    }
  } else if (!binPathExists) {
    console.log(
      `The binary: ${chalk4.bgBlack.greenBright(
        binName
      )} is missing from: ${chalk4.bgBlack.greenBright(path6.join(process.cwd(), binDir))}`
    );
    console.log(
      `Given you are running ${chalk4.bgBlack.yellowBright(
        process.arch
      )} architecture, you will need to build it manually from source \u{1F6E0}\uFE0F`
    );
    throw new Error("Executable binary not available");
  }
}
function checkListeningPorts(processId) {
  try {
    const stdOut = execSync2(`lsof -p  ${processId} | grep LISTEN`, {
      encoding: "utf-8",
    });
    const binName = stdOut.split("\n")[0].split(" ")[0];
    const ports = stdOut
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const port = line.split(":")[1];
        return port.split(" ")[0];
      });
    const filtered = new Set(ports);
    return { binName, processId, ports: [...filtered].sort() };
  } catch (e) {
    const binName = execSync2(`ps -p ${processId} -o comm=`).toString().trim();
    console.log(
      `Process ${processId} is running which for binary ${binName}, however it is unresponsive.`
    );
    console.log(
      "Running Moonwall with this in the background may cause unexpected behaviour. Please manually kill the process and try running Moonwall again."
    );
    console.log(`N.B. You can kill it with: sudo kill -9 ${processId}`);
    throw new Error(e);
  }
}
function checkAlreadyRunning(binaryName) {
  try {
    console.log(
      `Checking if ${chalk4.bgWhiteBright.blackBright(binaryName)} is already running...`
    );
    const stdout = execSync2(`pgrep ${[binaryName.slice(0, 14)]}`, {
      encoding: "utf8",
      timeout: 2e3,
    });
    const pIdStrings = stdout.split("\n").filter(Boolean);
    return pIdStrings.map((pId) => Number.parseInt(pId, 10));
  } catch (error) {
    if (error.status === 1) {
      return [];
    }
    throw error;
  }
}
async function promptAlreadyRunning(pids) {
  const alreadyRunning = await select2({
    message: `The following processes are already running: 
${pids
  .map((pid) => {
    const { binName, ports } = checkListeningPorts(pid);
    return `${binName} - pid: ${pid}, listenPorts: [${ports.join(", ")}]`;
  })
  .join("\n")}`,
    default: 1,
    choices: [
      { name: "\u{1FA93}  Kill processes and continue", value: "kill" },
      { name: "\u27A1\uFE0F   Continue (and let processes live)", value: "continue" },
      { name: "\u{1F6D1}  Abort (and let processes live)", value: "abort" },
    ],
  });
  switch (alreadyRunning) {
    case "kill":
      for (const pid of pids) {
        execSync2(`kill ${pid}`);
      }
      break;
    case "continue":
      break;
    case "abort":
      throw new Error("Abort Signal Picked");
  }
}
function checkAccess(path10) {
  const binPath = path10.split(" ")[0];
  try {
    fs6.accessSync(binPath, fs6.constants.X_OK);
  } catch (err) {
    console.error(`The file ${binPath} is not executable`);
    throw new Error(`The file at ${binPath} , lacks execute permissions.`);
  }
}
async function getBinaryArchitecture(filePath) {
  return new Promise((resolve, reject) => {
    const architectureMap = {
      0: "unknown",
      3: "x86",
      62: "x64",
      183: "arm64",
    };
    fs6.open(filePath, "r", (err, fd) => {
      if (err) {
        reject(err);
        return;
      }
      const buffer = Buffer.alloc(20);
      fs6.read(fd, buffer, 0, 20, 0, (err2, bytesRead, buffer2) => {
        if (err2) {
          reject(err2);
          return;
        }
        const e_machine = buffer2.readUInt16LE(18);
        const architecture = architectureMap[e_machine] || "unknown";
        resolve(architecture);
      });
    });
  });
}

// src/internal/foundations/chopsticksHelpers.ts
import "@moonbeam-network/api-augment";
import chalk6 from "chalk";
import { setTimeout as setTimeout2 } from "timers/promises";

// src/lib/globalContext.ts
import "@moonbeam-network/api-augment";
import zombie from "@zombienet/orchestrator";
import { createLogger as createLogger4 } from "@moonwall/util";
import fs9 from "fs";
import net3 from "net";
import readline from "readline";
import { setTimeout as timer3 } from "timers/promises";
import path8 from "path";

// src/internal/foundations/zombieHelpers.ts
import chalk5 from "chalk";
import fs7 from "fs";
import invariant2 from "tiny-invariant";
import { setTimeout as timer } from "timers/promises";
import net2 from "net";
async function checkZombieBins(config) {
  const relayBinPath = config.relaychain.default_command;
  if (!relayBinPath) {
    throw new Error("No relayBinPath '[relaychain.default_command]' specified in zombie config");
  }
  await checkExists(relayBinPath);
  checkAccess(relayBinPath);
  if (config.parachains) {
    const promises = config.parachains.map((para) => {
      if (para.collator) {
        if (!para.collator.command) {
          throw new Error(
            "No command found for collator, please check your zombienet config file for collator command"
          );
        }
        checkExists(para.collator.command);
        checkAccess(para.collator.command);
      }
      if (para.collators) {
        for (const coll of para.collators) {
          if (!coll.command) {
            throw new Error(
              "No command found for collators, please check your zombienet config file for collators command"
            );
          }
          checkExists(coll.command);
          checkAccess(coll.command);
        }
      }
    });
    await Promise.all(promises);
  }
}
function getZombieConfig(path10) {
  const fsResult = fs7.existsSync(path10);
  if (!fsResult) {
    throw new Error(
      `No ZombieConfig file found at location: ${path10} 
 Are you sure your ${chalk5.bgWhiteBright.blackBright(
   "moonwall.config.json"
 )} file has the correct "configPath" in zombieSpec?`
    );
  }
  const buffer = fs7.readFileSync(path10, "utf-8");
  return JSON.parse(buffer);
}
async function sendIpcMessage(message) {
  return new Promise(async (resolve, reject) => {
    let response;
    const ipcPath = process.env.MOON_IPC_SOCKET;
    invariant2(ipcPath, "No IPC path found. This is a bug, please report it.");
    const client = net2.createConnection({ path: ipcPath }, () => {
      console.log("\u{1F4E8} Successfully connected to IPC server");
    });
    client.on("error", (err) => {
      console.error("\u{1F4E8} IPC client connection error:", err);
    });
    client.on("data", async (data) => {
      response = JSON.parse(data.toString());
      if (response.status === "success") {
        client.end();
        for (let i = 0; ; i++) {
          if (client.closed) {
            break;
          }
          if (i > 100) {
            reject(new Error("Closing IPC connection failed"));
          }
          await timer(200);
        }
        resolve(response);
      }
      if (response.status === "failure") {
        reject(new Error(JSON.stringify(response)));
      }
    });
    for (let i = 0; ; i++) {
      if (!client.connecting) {
        break;
      }
      if (i > 100) {
        reject(new Error(`Connection to ${ipcPath} failed`));
      }
      await timer(200);
    }
    await new Promise((resolve2) => {
      client.write(JSON.stringify(message), () => resolve2("Sent!"));
    });
  });
}

// src/internal/localNode.ts
import { exec, spawn, spawnSync } from "child_process";
import fs8 from "fs";
import path7 from "path";
import WebSocket from "ws";
init_configReader();
import { createLogger as createLogger2 } from "@moonwall/util";
import { setTimeout as timer2 } from "timers/promises";
import util from "util";
import Docker from "dockerode";
import invariant3 from "tiny-invariant";
var execAsync2 = util.promisify(exec);
var logger2 = createLogger2({ name: "localNode" });
var debug2 = logger2.debug.bind(logger2);
async function launchDockerContainer(imageName, args, name, dockerConfig) {
  const docker = new Docker();
  const port = args.find((a) => a.includes("port"))?.split("=")[1];
  debug2(`\x1B[36mStarting Docker container ${imageName} on port ${port}...\x1B[0m`);
  const dirPath = path7.join(process.cwd(), "tmp", "node_logs");
  const logLocation = path7.join(dirPath, `${name}_docker_${Date.now()}.log`);
  const fsStream = fs8.createWriteStream(logLocation);
  process.env.MOON_LOG_LOCATION = logLocation;
  const portBindings = dockerConfig?.exposePorts?.reduce((acc, { hostPort, internalPort }) => {
    acc[`${internalPort}/tcp`] = [{ HostPort: hostPort.toString() }];
    return acc;
  }, {});
  const rpcPort = args.find((a) => a.includes("rpc-port"))?.split("=")[1];
  invariant3(rpcPort, "RPC port not found, this is a bug");
  const containerOptions = {
    Image: imageName,
    platform: "linux/amd64",
    Cmd: args,
    name: dockerConfig?.containerName || `moonwall_${name}_${Date.now()}`,
    ExposedPorts: {
      ...Object.fromEntries(
        dockerConfig?.exposePorts?.map(({ internalPort }) => [`${internalPort}/tcp`, {}]) || []
      ),
      [`${rpcPort}/tcp`]: {},
    },
    HostConfig: {
      PortBindings: {
        ...portBindings,
        [`${rpcPort}/tcp`]: [{ HostPort: rpcPort }],
      },
    },
    Env: dockerConfig?.runArgs?.filter((arg) => arg.startsWith("env:")).map((arg) => arg.slice(4)),
  };
  try {
    await pullImage(imageName, docker);
    const container = await docker.createContainer(containerOptions);
    await container.start();
    const containerInfo = await container.inspect();
    if (!containerInfo.State.Running) {
      const errorMessage = `Container failed to start: ${containerInfo.State.Error}`;
      console.error(errorMessage);
      fs8.appendFileSync(
        logLocation,
        `${errorMessage}
`
      );
      throw new Error(errorMessage);
    }
    for (let i = 0; i < 300; i++) {
      const isReady = await checkWebSocketJSONRPC(Number.parseInt(rpcPort));
      if (isReady) {
        break;
      }
      await timer2(100);
    }
    return { runningNode: container, fsStream };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Docker container launch failed: ${error.message}`);
      fs8.appendFileSync(
        logLocation,
        `Docker launch error: ${error.message}
`
      );
    }
    throw error;
  }
}
async function launchNode(options) {
  const { command: cmd, args, name, launchSpec: config } = options;
  if (config?.useDocker) {
    return launchDockerContainer(cmd, args, name, config.dockerConfig);
  }
  if (cmd.includes("moonbeam")) {
    await checkExists(cmd);
    checkAccess(cmd);
  }
  const port = args.find((a) => a.includes("port"))?.split("=")[1];
  debug2(`\x1B[36mStarting ${name} node on port ${port}...\x1B[0m`);
  const dirPath = path7.join(process.cwd(), "tmp", "node_logs");
  const runningNode = spawn(cmd, args);
  const logLocation = path7
    .join(
      dirPath,
      `${path7.basename(cmd)}_node_${args.find((a) => a.includes("port"))?.split("=")[1]}_${runningNode.pid}.log`
    )
    .replaceAll("node_node_undefined", "chopsticks");
  process.env.MOON_LOG_LOCATION = logLocation;
  const fsStream = fs8.createWriteStream(logLocation);
  runningNode.on("error", (err) => {
    if (err.errno === "ENOENT") {
      console.error(`\x1B[31mMissing Local binary at(${cmd}).
Please compile the project\x1B[0m`);
    }
    throw new Error(err.message);
  });
  const logHandler = (chunk) => {
    if (fsStream.writable) {
      fsStream.write(chunk, (err) => {
        if (err) console.error(err);
        else fsStream.emit("drain");
      });
    }
  };
  runningNode.stderr?.on("data", logHandler);
  runningNode.stdout?.on("data", logHandler);
  runningNode.once("exit", (code, signal) => {
    const timestamp = /* @__PURE__ */ new Date().toISOString();
    let message;
    const moonwallNode = runningNode;
    if (moonwallNode.isMoonwallTerminating) {
      message = `${timestamp} [moonwall] process killed. reason: ${moonwallNode.moonwallTerminationReason || "unknown"}`;
    } else if (code !== null) {
      message = `${timestamp} [moonwall] process exited with status code ${code}`;
    } else if (signal !== null) {
      message = `${timestamp} [moonwall] process terminated by signal ${signal}`;
    } else {
      message = `${timestamp} [moonwall] process terminated unexpectedly`;
    }
    if (fsStream.writable) {
      fsStream.write(
        `${message}
`,
        (err) => {
          if (err) console.error(`Failed to write exit message to log: ${err}`);
          fsStream.end();
        }
      );
    } else {
      try {
        fs8.appendFileSync(
          logLocation,
          `${message}
`
        );
      } catch (err) {
        console.error(`Failed to append exit message to log file: ${err}`);
      }
      fsStream.end();
    }
    runningNode.stderr?.removeListener("data", logHandler);
    runningNode.stdout?.removeListener("data", logHandler);
  });
  if (!runningNode.pid) {
    const errorMessage = "Failed to start child process";
    console.error(errorMessage);
    fs8.appendFileSync(
      logLocation,
      `${errorMessage}
`
    );
    throw new Error(errorMessage);
  }
  if (runningNode.exitCode !== null) {
    const errorMessage = `Child process exited immediately with code ${runningNode.exitCode}`;
    console.error(errorMessage);
    fs8.appendFileSync(
      logLocation,
      `${errorMessage}
`
    );
    throw new Error(errorMessage);
  }
  const isRunning = await isPidRunning(runningNode.pid);
  if (!isRunning) {
    const errorMessage = `Process with PID ${runningNode.pid} is not running`;
    spawnSync(cmd, args, { stdio: "inherit" });
    throw new Error(errorMessage);
  }
  probe: for (let i = 0; ; i++) {
    try {
      const ports = await findPortsByPid(runningNode.pid);
      if (ports) {
        for (const port2 of ports) {
          try {
            const isReady = await checkWebSocketJSONRPC(port2);
            if (isReady) {
              break probe;
            }
          } catch {}
        }
      }
    } catch {
      if (i === 300) {
        throw new Error("Could not find ports for node after 30 seconds");
      }
      await timer2(100);
      continue;
    }
    await timer2(100);
  }
  return { runningNode, fsStream };
}
function isPidRunning(pid) {
  return new Promise((resolve) => {
    exec(`ps -p ${pid} -o pid=`, (error, stdout, stderr) => {
      if (error) {
        resolve(false);
      } else {
        resolve(stdout.trim() !== "");
      }
    });
  });
}
async function checkWebSocketJSONRPC(port) {
  try {
    const isEthereumChain = isEthereumDevConfig() || isEthereumZombieConfig();
    const ws = new WebSocket(`ws://localhost:${port}`);
    const checkWsMethod = async (method) => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5e3);
        ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: Math.floor(Math.random() * 1e4),
            method,
            params: [],
          })
        );
        const messageHandler = (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.jsonrpc === "2.0" && !response.error) {
              clearTimeout(timeout);
              ws.removeListener("message", messageHandler);
              resolve(true);
            }
          } catch (e) {}
        };
        ws.on("message", messageHandler);
      });
    };
    const wsResult = await new Promise((resolve) => {
      ws.on("open", async () => {
        try {
          const systemChainAvailable = await checkWsMethod("system_chain");
          if (!systemChainAvailable) {
            resolve(false);
            return;
          }
          if (isEthereumChain) {
            const ethChainIdAvailable = await checkWsMethod("eth_chainId");
            if (!ethChainIdAvailable) {
              resolve(false);
              return;
            }
          }
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      });
      ws.on("error", () => {
        resolve(false);
      });
    });
    ws?.close();
    if (!wsResult) {
      return false;
    }
    const httpUrl = `http://localhost:${port}`;
    const checkHttpMethod = async (method) => {
      try {
        const response = await fetch(httpUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Math.floor(Math.random() * 1e4),
            method,
            params: [],
          }),
        });
        if (!response.ok) {
          return false;
        }
        const data = await response.json();
        return !data.error;
      } catch (e) {
        return false;
      }
    };
    try {
      const systemChainAvailable = await checkHttpMethod("system_chain");
      if (!systemChainAvailable) {
        return false;
      }
      if (isEthereumChain) {
        const ethChainIdAvailable = await checkHttpMethod("eth_chainId");
        return ethChainIdAvailable;
      }
      return true;
    } catch (e) {
      return false;
    }
  } catch {
    return false;
  }
}
async function findPortsByPid(pid, retryCount = 600, retryDelay = 100) {
  for (let i = 0; i < retryCount; i++) {
    try {
      const { stdout } = await execAsync2(`lsof -p ${pid} -n -P | grep LISTEN`);
      const ports = [];
      const lines = stdout.split("\n");
      for (const line of lines) {
        const regex = /(?:.+):(\d+)/;
        const match = line.match(regex);
        if (match) {
          ports.push(Number(match[1]));
        }
      }
      if (ports.length) {
        return ports;
      }
      throw new Error("Could not find any ports");
    } catch (error) {
      if (i === retryCount - 1) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }
  return [];
}
async function pullImage(imageName, docker) {
  console.log(`Pulling Docker image: ${imageName}`);
  const pullStream = await docker.pull(imageName);
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(pullStream, (err, output) => {
      if (err) {
        reject(err);
      } else {
        resolve(output);
      }
    });
  });
}

// src/internal/providerFactories.ts
import { ALITH_PRIVATE_KEY, deriveViemChain } from "@moonwall/util";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Wallet, ethers } from "ethers";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Web3 } from "web3";
import { WebSocketProvider } from "web3-providers-ws";
import { createClient } from "polkadot-api";
import { getWsProvider, WsEvent } from "polkadot-api/ws-provider/web";
import { createLogger as createLogger3 } from "@moonwall/util";
var logger3 = createLogger3({ name: "providers" });
var debug3 = logger3.debug.bind(logger3);
var ProviderFactory = class _ProviderFactory {
  constructor(providerConfig) {
    this.providerConfig = providerConfig;
    this.url = providerConfig.endpoints.includes("ENV_VAR")
      ? process.env.WSS_URL || "error_missing_WSS_URL_env_var"
      : providerConfig.endpoints[0];
    this.privateKey = process.env.MOON_PRIV_KEY || ALITH_PRIVATE_KEY;
  }
  url;
  privateKey;
  create() {
    switch (this.providerConfig.type) {
      case "polkadotJs":
        return this.createPolkadotJs();
      case "web3":
        return this.createWeb3();
      case "ethers":
        return this.createEthers();
      case "viem":
        return this.createViem();
      case "papi":
        return this.createPapi();
      default:
        return this.createDefault();
    }
  }
  createPolkadotJs() {
    debug3(`\u{1F7E2}  PolkadotJs provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        process.env.DEFAULT_TIMEOUT_MS = "30000";
        const options = {
          provider: new WsProvider(this.url),
          initWasm: false,
          noInitWarn: true,
          isPedantic: false,
          rpc: this.providerConfig.rpc ? this.providerConfig.rpc : void 0,
          typesBundle: this.providerConfig.additionalTypes
            ? this.providerConfig.additionalTypes
            : void 0,
        };
        const api = await ApiPromise.create(options);
        await api.isReady;
        return api;
      },
      ws: () => new WsProvider(this.url),
    };
  }
  createWeb3() {
    debug3(`\u{1F7E2}  Web3 provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = new WebSocketProvider(
          this.url,
          {},
          { delay: 50, autoReconnect: false, maxAttempts: 10 }
        );
        return new Web3(provider);
      },
    };
  }
  createEthers() {
    debug3(`\u{1F7E2}  Ethers provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = this.url.startsWith("ws")
          ? new ethers.WebSocketProvider(this.url)
          : new ethers.JsonRpcProvider(this.url);
        return new Wallet(this.privateKey, provider);
      },
    };
  }
  createViem() {
    debug3(`\u{1F7E2}  Viem omni provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        try {
          debug3(
            `\u{1F50C} Attempting to derive chain for viem provider ${this.providerConfig.name} from ${this.url}`
          );
          const chain = await deriveViemChain(this.url);
          const client = createWalletClient({
            chain,
            account: privateKeyToAccount(this.privateKey),
            transport: http(this.url.replace("ws", "http")),
          }).extend(publicActions);
          return client;
        } catch (error) {
          console.error(
            `\u274C Failed to create viem provider ${this.providerConfig.name}: ${error.message}`
          );
          throw new Error(
            `Viem provider initialization failed for ${this.providerConfig.name}: ${error.message}`
          );
        }
      },
    };
  }
  createPapi() {
    debug3(`\u{1F7E2}  Papi provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        const provider = getWsProvider(this.url, (status) => {
          switch (status.type) {
            case WsEvent.CONNECTING:
              console.log("Connecting... \u{1F50C}");
              break;
            case WsEvent.CONNECTED:
              console.log("Connected! \u26A1");
              break;
            case WsEvent.ERROR:
              console.log("Errored... \u{1F622}");
              break;
            case WsEvent.CLOSE:
              console.log("Closed \u{1F6AA}");
              break;
          }
        });
        return createClient(provider);
      },
    };
  }
  createDefault() {
    debug3(`\u{1F7E2}  Default provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: () => {
        console.log(`\u{1F6A7}  provider ${this.providerConfig.name} not yet implemented`);
        return null;
      },
    };
  }
  static prepare(providerConfigs) {
    return providerConfigs.map((providerConfig) => new _ProviderFactory(providerConfig).create());
  }
  static prepareDefaultDev() {
    return _ProviderFactory.prepare([
      {
        name: "dev",
        type: "polkadotJs",
        endpoints: [vitestAutoUrl()],
      },
      {
        name: "w3",
        type: "web3",
        endpoints: [vitestAutoUrl()],
      },
      {
        name: "eth",
        type: "ethers",
        endpoints: [vitestAutoUrl()],
      },
      {
        name: "public",
        type: "viem",
        endpoints: [vitestAutoUrl()],
      },
    ]);
  }
  static prepareDefaultZombie() {
    const MOON_PARA_WSS = process.env.MOON_PARA_WSS || "error";
    const MOON_RELAY_WSS = process.env.MOON_RELAY_WSS || "error";
    const providers = [
      {
        name: "w3",
        type: "web3",
        endpoints: [MOON_PARA_WSS],
      },
      {
        name: "eth",
        type: "ethers",
        endpoints: [MOON_PARA_WSS],
      },
      {
        name: "viem",
        type: "viem",
        endpoints: [MOON_PARA_WSS],
      },
      {
        name: "relaychain",
        type: "polkadotJs",
        endpoints: [MOON_RELAY_WSS],
      },
    ];
    if (MOON_PARA_WSS !== "error") {
      providers.push({
        name: "parachain",
        type: "polkadotJs",
        endpoints: [MOON_PARA_WSS],
      });
    }
    return _ProviderFactory.prepare(providers);
  }
  static prepareNoEthDefaultZombie() {
    const MOON_PARA_WSS = process.env.MOON_PARA_WSS || "error";
    const MOON_RELAY_WSS = process.env.MOON_RELAY_WSS || "error";
    const providers = [
      {
        name: "relaychain",
        type: "polkadotJs",
        endpoints: [MOON_RELAY_WSS],
      },
    ];
    if (MOON_PARA_WSS !== "error") {
      providers.push({
        name: "parachain",
        type: "polkadotJs",
        endpoints: [MOON_PARA_WSS],
      });
    }
    return _ProviderFactory.prepare(providers);
  }
};
var ProviderInterfaceFactory = class _ProviderInterfaceFactory {
  constructor(name, type, connect) {
    this.name = name;
    this.type = type;
    this.connect = connect;
  }
  async create() {
    switch (this.type) {
      case "polkadotJs":
        return this.createPolkadotJs();
      case "web3":
        return this.createWeb3();
      case "ethers":
        return this.createEthers();
      case "viem":
        return this.createViem();
      case "papi":
        return this.createPapi();
      default:
        throw new Error("UNKNOWN TYPE");
    }
  }
  async createPolkadotJs() {
    debug3(`\u{1F50C} Connecting PolkadotJs provider: ${this.name}`);
    const api = await this.connect();
    debug3(`\u2705 PolkadotJs provider ${this.name} connected`);
    1;
    return {
      name: this.name,
      api,
      type: "polkadotJs",
      greet: async () => {
        debug3(
          `\u{1F44B}  Provider ${this.name} is connected to chain ${api.consts.system.version.specName.toString()} RT${api.consts.system.version.specVersion.toNumber()}`
        );
        return {
          rtVersion: api.consts.system.version.specVersion.toNumber(),
          rtName: api.consts.system.version.specName.toString(),
        };
      },
      disconnect: async () => api.disconnect(),
    };
  }
  async createWeb3() {
    const api = await this.connect();
    return {
      name: this.name,
      api,
      type: "web3",
      greet: async () =>
        console.log(
          `\u{1F44B} Provider ${this.name} is connected to chain ${await api.eth.getChainId()}`
        ),
      disconnect: async () => {
        if (!api.eth.net.currentProvider) {
          throw new Error("No connected web3 provider to disconnect from");
        }
        api.eth.net.currentProvider.disconnect();
      },
    };
  }
  async createEthers() {
    const api = await this.connect();
    return {
      name: this.name,
      api,
      type: "ethers",
      greet: async () => {
        if (!api.provider) {
          throw new Error("No connected ethers provider to greet with");
        }
        debug3(
          `\u{1F44B}  Provider ${this.name} is connected to chain ${(await api.provider.getNetwork()).chainId}`
        );
      },
      disconnect: () => {
        if (!api.provider) {
          throw new Error("No connected ethers provider to disconnect from");
        }
        api.provider.destroy();
      },
    };
  }
  async createViem() {
    const api = await this.connect();
    return {
      name: this.name,
      api,
      type: "viem",
      greet: async () =>
        console.log(
          `\u{1F44B} Provider ${this.name} is connected to chain ${await api.getChainId()}`
        ),
      disconnect: async () => {},
    };
  }
  async createPapi() {
    const api = await this.connect();
    return {
      name: this.name,
      api,
      type: "papi",
      greet: async () => {
        const unsafeApi = await api.getUnsafeApi();
        const { spec_version, spec_name } = await unsafeApi.constants.System.Version();
        return { rtVersion: spec_version, rtName: spec_name };
      },
      async disconnect() {
        api.destroy();
      },
    };
  }
  static async populate(name, type, connect) {
    debug3(`\u{1F504} Populating provider: ${name} of type: ${type}`);
    try {
      const providerInterface = await new _ProviderInterfaceFactory(name, type, connect).create();
      debug3(`\u2705 Successfully populated provider: ${name}`);
      return providerInterface;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`\u274C Failed to populate provider: ${name} - ${error.message}`);
      } else {
        console.error(`\u274C Failed to populate provider: ${name} - Unknown error`);
      }
      throw error;
    }
  }
};
var vitestAutoUrl = () => `ws://127.0.0.1:${process.env.MOONWALL_RPC_PORT}`;

// src/lib/globalContext.ts
init_configReader();
import { ChildProcess, exec as exec2, execSync as execSync3 } from "child_process";
import { promisify as promisify2 } from "util";
import Docker2 from "dockerode";
import invariant4 from "tiny-invariant";
var logger4 = createLogger4({ name: "context" });
var debugSetup = logger4.debug.bind(logger4);
var MoonwallContext = class _MoonwallContext {
  static instance;
  configured = false;
  environment;
  providers;
  nodes;
  foundation;
  zombieNetwork;
  rtUpgradePath;
  ipcServer;
  injectedOptions;
  nodeCleanupHandlers = [];
  constructor(config, options) {
    const env = config.environments.find(({ name }) => name === process.env.MOON_TEST_ENV);
    invariant4(env, `Environment ${process.env.MOON_TEST_ENV} not found in config`);
    this.providers = [];
    this.nodes = [];
    this.foundation = env.foundation.type;
    this.injectedOptions = options;
  }
  async setupFoundation() {
    const config = await importAsyncConfig();
    const env = config.environments.find(({ name }) => name === process.env.MOON_TEST_ENV);
    invariant4(env, `Environment ${process.env.MOON_TEST_ENV} not found in config`);
    const foundationHandlers = {
      read_only: this.handleReadOnly,
      chopsticks: this.handleChopsticks,
      dev: this.handleDev,
      zombie: this.handleZombie,
    };
    const foundationHandler = foundationHandlers[env.foundation.type];
    this.environment = {
      providers: [],
      nodes: [],
      ...(await foundationHandler.call(this, env, config)),
    };
    this.configured = true;
  }
  async handleZombie(env) {
    invariant4(env.foundation.type === "zombie", "Foundation type must be 'zombie'");
    const { cmd: zombieConfig } = await parseZombieCmd(env.foundation.zombieSpec);
    this.rtUpgradePath = env.foundation.rtUpgradePath;
    return {
      name: env.name,
      foundationType: "zombie",
      nodes: [
        {
          name: env.foundation.zombieSpec.name,
          cmd: zombieConfig,
          args: [],
          launch: true,
        },
      ],
    };
  }
  async handleDev(env, config) {
    invariant4(env.foundation.type === "dev", "Foundation type must be 'dev'");
    const { cmd, args, launch } = await LaunchCommandParser.create({
      launchSpec: env.foundation.launchSpec[0],
      additionalRepos: config.additionalRepos,
      launchOverrides: this.injectedOptions,
      verbose: false,
    });
    return {
      name: env.name,
      foundationType: "dev",
      nodes: [
        {
          name: env.foundation.launchSpec[0].name,
          cmd,
          args,
          launch,
        },
      ],
      providers: env.connections
        ? ProviderFactory.prepare(env.connections)
        : isEthereumDevConfig()
          ? ProviderFactory.prepareDefaultDev()
          : ProviderFactory.prepare([
              {
                name: "node",
                type: "polkadotJs",
                endpoints: [vitestAutoUrl()],
              },
            ]),
    };
  }
  async handleReadOnly(env) {
    invariant4(env.foundation.type === "read_only", "Foundation type must be 'read_only'");
    invariant4(
      env.connections,
      `${env.name} env config is missing connections specification, required by foundation READ_ONLY`
    );
    return {
      name: env.name,
      foundationType: "read_only",
      providers: ProviderFactory.prepare(env.connections),
    };
  }
  async handleChopsticks(env) {
    invariant4(env.foundation.type === "chopsticks", "Foundation type must be 'chopsticks'");
    invariant4(
      env.connections && env.connections.length > 0,
      `${env.name} env config is missing connections specification, required by foundation CHOPSTICKS`
    );
    this.rtUpgradePath = env.foundation.rtUpgradePath;
    return {
      name: env.name,
      foundationType: "chopsticks",
      nodes: [parseChopsticksRunCmd(env.foundation.launchSpec)],
      providers: [...ProviderFactory.prepare(env.connections)],
    };
  }
  async startZombieNetwork() {
    const env = getEnvironmentFromConfig();
    invariant4(
      env.foundation.type === "zombie",
      "Foundation type must be 'zombie', something has gone very wrong."
    );
    console.log("\u{1F9DF} Spawning zombie nodes ...");
    const nodes = this.environment.nodes;
    const zombieConfig = getZombieConfig(nodes[0].cmd);
    await checkZombieBins(zombieConfig);
    const network = await zombie.start("", zombieConfig, { logType: "silent" });
    const ipcLogPath = path8.join(network.tmpDir, "ipc-server.log");
    const ipcLogger = fs9.createWriteStream(ipcLogPath, { flags: "a" });
    const logIpc = (message) => {
      const timestamp = /* @__PURE__ */ new Date().toISOString();
      ipcLogger.write(`${timestamp} - ${message}
`);
    };
    process.env.MOON_RELAY_WSS = network.relay[0].wsUri;
    if (Object.entries(network.paras).length > 0) {
      process.env.MOON_PARA_WSS = Object.values(network.paras)[0].nodes[0].wsUri;
    }
    const nodeNames = Object.keys(network.nodesByName);
    process.env.MOON_ZOMBIE_DIR = `${network.tmpDir}`;
    process.env.MOON_ZOMBIE_NODES = nodeNames.join("|");
    const onProcessExit = () => {
      try {
        invariant4(this.zombieNetwork, "Zombie network not found to kill");
        const processIds = Object.values(this.zombieNetwork.client.processMap)
          .filter((item) => item.pid)
          .map((process2) => process2.pid);
        exec2(`kill ${processIds.join(" ")}`, (error) => {
          if (error) {
            console.error(`Error killing process: ${error.message}`);
          }
        });
      } catch (err) {}
    };
    const socketPath = `${network.tmpDir}/node-ipc.sock`;
    if (fs9.existsSync(socketPath)) {
      fs9.unlinkSync(socketPath);
      logIpc(`Removed existing socket at ${socketPath}`);
    }
    const server = net3.createServer((client) => {
      logIpc("\u{1F4E8} IPC server created");
      logIpc(`Socket path: ${socketPath}`);
      client.on("data", async (data) => {
        const writeToClient = (message) => {
          if (client.writable) {
            client.write(JSON.stringify(message));
          } else {
            logIpc("Client disconnected, cannot send response.");
          }
        };
        try {
          const message = JSON.parse(data.toString());
          invariant4(message.nodeName, "nodeName not provided in message");
          const zombieClient = network.client;
          switch (message.cmd) {
            case "networkmap": {
              const result = Object.keys(network.nodesByName);
              writeToClient({
                status: "success",
                result: network.nodesByName,
                message: result.join("|"),
              });
              break;
            }
            case "restart": {
              logIpc(`\u{1F4E8} Restart command received for node:  ${message.nodeName}`);
              try {
                await this.disconnect();
                logIpc("\u2705 Disconnected all providers.");
              } catch (err) {
                logIpc(`\u274C Error during disconnect: ${err}`);
                throw err;
              }
              try {
                logIpc(`\u{1F4E8} Restarting node: ${message.nodeName}`);
                await zombieClient.restartNode(message.nodeName, 5);
                logIpc(`\u2705 Restarted node: ${message.nodeName}`);
              } catch (err) {
                logIpc(`\u274C Error during node restart: ${err}`);
                throw err;
              }
              await timer3(5e3);
              try {
                logIpc("\u{1F504} Reconnecting environment...");
                await this.connectEnvironment();
                logIpc("\u2705 Reconnected environment.");
              } catch (err) {
                logIpc(`\u274C Error during environment reconnection: ${err}`);
                throw err;
              }
              writeToClient({
                status: "success",
                result: true,
                message: `${message.nodeName} restarted`,
              });
              break;
            }
            case "resume": {
              const node = network.getNodeByName(message.nodeName);
              await this.disconnect();
              const result = await node.resume();
              await zombieClient.wait_node_ready(message.nodeName);
              await this.connectEnvironment(true);
              writeToClient({
                status: "success",
                result,
                message: `${message.nodeName} resumed with result ${result}`,
              });
              break;
            }
            case "pause": {
              const node = network.getNodeByName(message.nodeName);
              await this.disconnect();
              const result = await node.pause();
              await timer3(1e3);
              writeToClient({
                status: "success",
                result,
                message: `${message.nodeName} paused with result ${result}`,
              });
              break;
            }
            case "kill": {
              const pid = network.client.processMap[message.nodeName].pid;
              delete network.client.processMap[message.nodeName];
              const killResult = execSync3(`kill ${pid}`, { stdio: "ignore" });
              writeToClient({
                status: "success",
                result: true,
                message: `${message.nodeName}, pid ${pid} killed`,
              });
              break;
            }
            case "isup": {
              const node = network.getNodeByName(message.nodeName);
              const result = await node.isUp();
              writeToClient({
                status: "success",
                result,
                message: `${message.nodeName} isUp result is ${result}`,
              });
              break;
            }
            default:
              invariant4(false, `Invalid command received: ${message.cmd}`);
          }
        } catch (e) {
          logIpc("\u{1F4E8} Error processing message from client");
          logIpc(e.message);
          writeToClient({
            status: "failure",
            result: false,
            message: e.message,
          });
        }
      });
      client.on("error", (err) => {
        logIpc(`\u{1F4E8} IPC client error:${err}`);
      });
      client.on("close", () => {
        logIpc("\u{1F4E8} IPC client disconnected");
      });
    });
    server.on("error", (err) => {
      console.error("IPC Server error:", err);
    });
    server.listen(socketPath, () => {
      logIpc(`\u{1F4E8} IPC Server attempting to listen on ${socketPath}`);
      try {
        fs9.chmodSync(socketPath, 384);
        logIpc("\u{1F4E8} Successfully set socket permissions");
      } catch (err) {
        console.error("\u{1F4E8} Error setting socket permissions:", err);
      }
      logIpc(`\u{1F4E8} IPC Server listening on ${socketPath}`);
    });
    this.ipcServer = server;
    process.env.MOON_IPC_SOCKET = socketPath;
    process.once("exit", onProcessExit);
    process.once("SIGINT", onProcessExit);
    this.zombieNetwork = network;
    return;
  }
  async startNetwork() {
    const ctx = await _MoonwallContext.getContext();
    if (process.env.MOON_RECYCLE === "true") {
      return ctx;
    }
    if (this.nodes.length > 0) {
      return ctx;
    }
    const nodes = ctx.environment.nodes;
    if (this.environment.foundationType === "zombie") {
      return await this.startZombieNetwork();
    }
    const env = getEnvironmentFromConfig();
    const launchSpec = "launchSpec" in env.foundation ? env.foundation.launchSpec[0] : void 0;
    const maxStartupTimeout = launchSpec?.useDocker ? 3e5 : 3e4;
    await withTimeout(
      Promise.all(
        nodes.map(async ({ cmd, args, name, launch }) => {
          if (launch) {
            try {
              const result = await launchNode({
                command: cmd,
                args,
                name: name || "node",
                launchSpec,
              });
              this.nodes.push(result.runningNode);
              if (result.runningNode instanceof ChildProcess) {
                debugSetup(
                  `\u2705 Node '${name || "unnamed"}' started with PID ${result.runningNode.pid}`
                );
              }
            } catch (error) {
              throw new Error(`Failed to start node '${name || "unnamed"}': ${error.message}`);
            }
          }
        })
      ),
      maxStartupTimeout
    );
    debugSetup("\u2705 All network nodes started successfully.");
    return ctx;
  }
  async connectEnvironment(silent = false) {
    const env = getEnvironmentFromConfig();
    if (this.environment.foundationType === "zombie") {
      this.environment.providers = env.connections
        ? ProviderFactory.prepare(env.connections)
        : isEthereumZombieConfig()
          ? ProviderFactory.prepareDefaultZombie()
          : ProviderFactory.prepareNoEthDefaultZombie();
    }
    if (this.providers.length > 0) {
      return _MoonwallContext.getContext();
    }
    const maxRetries = 15;
    const retryDelay = 1e3;
    const connectTimeout = 1e4;
    const connectWithRetry = async (provider) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          debugSetup(`\u{1F504} Connecting provider ${provider.name}, attempt ${attempt}`);
          const connectedProvider = await Promise.race([
            ProviderInterfaceFactory.populate(provider.name, provider.type, provider.connect),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Connection attempt timed out")), connectTimeout)
            ),
          ]);
          this.providers.push(connectedProvider);
          debugSetup(`\u2705 Provider ${provider.name} connected on attempt ${attempt}`);
          return;
        } catch (error) {
          console.error(
            `\u274C Error connecting provider ${provider.name} on attempt ${attempt}: ${error.message}`
          );
          if (attempt === maxRetries) {
            throw new Error(
              `Failed to connect provider '${provider.name}' after ${maxRetries} attempts: ${error.message}`
            );
          }
          debugSetup(
            `\u26A0\uFE0F  Retrying provider ${provider.name} connection, attempt ${attempt + 1}/${maxRetries}`
          );
          await timer3(retryDelay);
        }
      }
    };
    try {
      await Promise.all(this.environment.providers.map(connectWithRetry));
    } catch (error) {
      console.error(`Error connecting to environment: ${error.message}`);
      console.error("Current providers:", this.providers.map((p) => p.name).join(", "));
      console.error(`Total providers: ${this.environment.providers.map((p) => p.name).join(", ")}`);
      throw error;
    }
    if (this.foundation === "zombie") {
      await this.handleZombiePostConnection(silent, env);
    }
    return _MoonwallContext.getContext();
  }
  async handleZombiePostConnection(silent, env) {
    let readStreams = [];
    if (!isOptionSet("disableLogEavesdropping")) {
      !silent &&
        console.log(`\u{1F9BB} Eavesdropping on node logs at ${process.env.MOON_ZOMBIE_DIR}`);
      const envVar = process.env.MOON_ZOMBIE_NODES;
      invariant4(envVar, "MOON_ZOMBIE_NODES not set, this is an error please raise.");
      const zombieNodeLogs = envVar
        .split("|")
        .map((nodeName) => `${process.env.MOON_ZOMBIE_DIR}/${nodeName}.log`);
      readStreams = zombieNodeLogs.map((logPath) => {
        const readStream = fs9.createReadStream(logPath, { encoding: "utf8" });
        const lineReader = readline.createInterface({
          input: readStream,
        });
        lineReader.on("line", (line) => {
          if (line.includes("WARN") || line.includes("ERROR")) {
            console.log(line);
          }
        });
        return readStream;
      });
    }
    const polkadotJsProviders = this.providers
      .filter(({ type }) => type === "polkadotJs")
      .filter(
        ({ name }) =>
          env.foundation.type === "zombie" &&
          (!env.foundation.zombieSpec.skipBlockCheck ||
            !env.foundation.zombieSpec.skipBlockCheck.includes(name))
      );
    await Promise.all(
      polkadotJsProviders.map(async (provider) => {
        !silent &&
          console.log(`\u23F2\uFE0F  Waiting for chain ${provider.name} to produce blocks...`);
        while ((await provider.api.rpc.chain.getBlock()).block.header.number.toNumber() === 0) {
          await timer3(500);
        }
        !silent && console.log(`\u2705 Chain ${provider.name} producing blocks, continuing`);
      })
    );
    if (!isOptionSet("disableLogEavesdropping")) {
      for (const readStream of readStreams) {
        readStream.close();
      }
    }
  }
  async disconnect(providerName) {
    if (providerName) {
      const prov = this.providers.find(({ name }) => name === providerName);
      invariant4(prov, `Provider ${providerName} not found`);
      try {
        await prov.disconnect();
        debugSetup(`\u2705 Provider ${providerName} disconnected`);
      } catch (error) {
        console.error(`\u274C Error disconnecting provider ${providerName}: ${error.message}`);
      }
    } else {
      await Promise.all(
        this.providers.map(async (prov) => {
          try {
            await prov.disconnect();
            debugSetup(`\u2705 Provider ${prov.name} disconnected`);
          } catch (error) {
            console.error(`\u274C Error disconnecting provider ${prov.name}: ${error.message}`);
          }
        })
      );
      this.providers = [];
    }
    if (this.nodes.length > 0) {
      for (const node of this.nodes) {
        if (node instanceof ChildProcess) {
          try {
            if (node.pid) {
              process.kill(node.pid);
            }
          } catch (e) {}
        }
        if (node instanceof Docker2.Container) {
          try {
            await node.stop();
            await node.remove();
          } catch (e) {}
        }
      }
      this.nodes = [];
    }
    if (this.nodeCleanupHandlers.length > 0) {
      await Promise.all(this.nodeCleanupHandlers.map((handler) => handler()));
      this.nodeCleanupHandlers = [];
    }
  }
  static async getContext(config, options, force = false) {
    invariant4(
      !(options && _MoonwallContext.instance),
      "Attempting to open a new context with overrides when context already exists"
    );
    if (!_MoonwallContext.instance?.configured || force) {
      invariant4(config, "Config must be provided on Global Context instantiation");
      _MoonwallContext.instance = new _MoonwallContext(config, options);
      await _MoonwallContext.instance.setupFoundation();
      debugSetup(`\u{1F7E2}  Moonwall context "${config.label}" created`);
    }
    return _MoonwallContext.instance;
  }
  static async destroy(reason) {
    const ctx = _MoonwallContext.instance;
    invariant4(ctx, "No context to destroy");
    try {
      await ctx.disconnect();
    } catch {
      console.log("\u{1F6D1}  All connections disconnected");
    }
    while (ctx.nodes.length > 0) {
      const node = ctx.nodes.pop();
      invariant4(node, "No node to destroy");
      if (node instanceof ChildProcess) {
        const pid = node.pid;
        invariant4(pid, "No pid to destroy");
        const moonwallNode = node;
        moonwallNode.isMoonwallTerminating = true;
        moonwallNode.moonwallTerminationReason = reason || "shutdown";
        node.kill("SIGINT");
        for (;;) {
          const isRunning = await isPidRunning2(pid);
          if (isRunning) {
            await timer3(10);
          } else {
            break;
          }
        }
      }
      if (node instanceof Docker2.Container) {
        console.log("\u{1F6D1}  Stopping container");
        const logLocation = process.env.MOON_LOG_LOCATION;
        if (logLocation) {
          const timestamp = /* @__PURE__ */ new Date().toISOString();
          const message = `${timestamp} [moonwall] container stopped. reason: ${reason || "shutdown"}
`;
          try {
            fs9.appendFileSync(logLocation, message);
          } catch (err) {
            console.error(`Failed to append termination message to Docker log: ${err}`);
          }
        }
        await node.stop();
        await node.remove();
        console.log("\u{1F6D1}  Container stopped and removed");
      }
    }
    if (ctx.zombieNetwork) {
      console.log("\u{1FA93}  Killing zombie nodes");
      const zombieProcesses = Object.values(ctx.zombieNetwork.client.processMap).filter(
        (item) => item.pid
      );
      for (const proc of zombieProcesses) {
        if (proc.logPath) {
          const timestamp = /* @__PURE__ */ new Date().toISOString();
          const message = `${timestamp} [moonwall] zombie network stopped. reason: ${reason || "shutdown"}
`;
          try {
            fs9.appendFileSync(proc.logPath, message);
          } catch (err) {
            console.error(`Failed to append termination message to zombie log: ${err}`);
          }
        }
      }
      await ctx.zombieNetwork.stop();
      const processIds = zombieProcesses.map((process2) => process2.pid);
      try {
        execSync3(`kill ${processIds.join(" ")}`, {});
      } catch (e) {
        console.log(e.message);
        console.log("continuing...");
      }
      await waitForPidsToDie(processIds);
      ctx.ipcServer?.close(() => {
        console.log("IPC Server closed.");
      });
      ctx.ipcServer?.removeAllListeners();
    }
  }
};
var execAsync3 = promisify2(exec2);
async function isPidRunning2(pid) {
  try {
    const { stdout } = await execAsync3(`ps -p ${pid} -o pid=`);
    return stdout.trim() === pid.toString();
  } catch (error) {
    return false;
  }
}
async function waitForPidsToDie(pids) {
  const checkPids = async () => {
    const checks = pids.map(async (pid) => await isPidRunning2(pid));
    const results = await Promise.all(checks);
    return results.every((running) => !running);
  };
  while (!(await checkPids())) {
    await new Promise((resolve) => setTimeout(resolve, 1e3));
  }
}

// src/internal/foundations/chopsticksHelpers.ts
async function getWsFromConfig(providerName) {
  if (providerName) {
    const provider2 = (await MoonwallContext.getContext()).environment.providers.find(
      ({ name }) => name === providerName
    );
    if (typeof provider2 === "undefined") {
      throw new Error(`Cannot find provider ${chalk6.bgWhiteBright.blackBright(providerName)}`);
    }
    if (!provider2.ws) {
      throw new Error("Provider does not have an attached ws() property ");
    }
    return provider2.ws();
  }
  const provider = (await MoonwallContext.getContext()).environment.providers.find(
    ({ type }) => type === "polkadotJs"
  );
  if (typeof provider === "undefined") {
    throw new Error(
      `Cannot find providers of type ${chalk6.bgWhiteBright.blackBright("polkadotJs")}`
    );
  }
  if (!provider.ws) {
    throw new Error("Provider does not have an attached ws() property ");
  }
  return provider.ws();
}
async function getWsUrlFromConfig(providerName) {
  const { getEnvironmentFromConfig: getEnvironmentFromConfig2 } = await Promise.resolve().then(
    () => (init_configReader(), configReader_exports)
  );
  const env = getEnvironmentFromConfig2();
  if (providerName) {
    const connection2 = env.connections?.find(({ name }) => name === providerName);
    if (connection2?.endpoints && connection2.endpoints.length > 0) {
      return connection2.endpoints[0];
    }
  }
  const connection = env.connections?.find(({ type }) => type === "polkadotJs");
  if (!connection || !connection.endpoints || connection.endpoints.length === 0) {
    throw new Error("No WebSocket endpoint found in configuration");
  }
  return connection.endpoints[0];
}
async function sendNewBlockAndCheck(context, expectedEvents) {
  const newBlock = await sendNewBlockRequest();
  const api = context.polkadotJs();
  const apiAt = await api.at(newBlock);
  const actualEvents = await apiAt.query.system.events();
  const match = expectedEvents.every((eEvt) => {
    return actualEvents
      .map((aEvt) => {
        if (
          api.events.system.ExtrinsicSuccess.is(aEvt.event) &&
          aEvt.event.data.dispatchInfo.class.toString() !== "Normal"
        ) {
          return false;
        }
        return eEvt.is(aEvt.event);
      })
      .reduce((acc, curr) => acc || curr, false);
  });
  return { match, events: actualEvents };
}
async function createChopsticksBlock(context, options = { allowFailures: false }) {
  const result = await sendNewBlockRequest(options);
  const apiAt = await context.polkadotJs(options.providerName).at(result);
  const actualEvents = await apiAt.query.system.events();
  if (options?.expectEvents) {
    const match = options.expectEvents.every((eEvt) => {
      const found = actualEvents
        .map((aEvt) => eEvt.is(aEvt.event))
        .reduce((acc, curr) => acc || curr, false);
      if (!found) {
        options.logger
          ? options.logger.error(
              `Event ${chalk6.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            )
          : console.error(
              `Event ${chalk6.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            );
      }
      return found;
    });
    if (!match) {
      throw new Error("Expected events not present in block");
    }
  }
  if (options && options.allowFailures === true) {
  } else {
    for (const event of actualEvents) {
      if (context.polkadotJs().events.system.ExtrinsicFailed.is(event.event)) {
        throw new Error(
          `ExtrinsicFailed event detected, enable 'allowFailures' if this is expected.`
        );
      }
    }
  }
  return { result };
}
async function sendSetHeadRequest(newHead, providerName) {
  const ws = providerName ? await getWsFromConfig(providerName) : await getWsFromConfig();
  let result = "";
  await ws.isReady;
  result = await ws.send("dev_setHead", [newHead]);
  await ws.disconnect();
  return result;
}
async function sendNewBlockRequest(params) {
  const ws = params ? await getWsFromConfig(params.providerName) : await getWsFromConfig();
  let result = "";
  while (!ws.isConnected) {
    await setTimeout2(100);
  }
  if (params?.count || params?.to) {
    result = await ws.send("dev_newBlock", [{ count: params.count, to: params.to }]);
  } else {
    result = await ws.send("dev_newBlock", [{ count: 1 }]);
  }
  await ws.disconnect();
  return result;
}
async function sendSetStorageRequest(params) {
  const ws = params ? await getWsFromConfig(params.providerName) : await getWsFromConfig();
  while (!ws.isConnected) {
    await setTimeout2(100);
  }
  await ws.send("dev_setStorage", [{ [params.module]: { [params.method]: params.methodParams } }]);
  await ws.disconnect();
}

// src/internal/foundations/devModeHelpers.ts
init_configReader();
import "@moonbeam-network/api-augment";
import {
  alith,
  createAndFinalizeBlock,
  customWeb3Request,
  generateKeyringPair,
} from "@moonwall/util";
import { Keyring } from "@polkadot/api";
import chalk7 from "chalk";
import { createLogger as createLogger5 } from "@moonwall/util";
import { setTimeout as setTimeout3 } from "timers/promises";

// src/lib/contextHelpers.ts
import "@moonbeam-network/api-augment";
function filterAndApply(events, section, methods, onFound) {
  return events
    .filter(({ event }) => section === event.section && methods.includes(event.method))
    .map((record) => onFound(record));
}
function getDispatchError({
  event: {
    data: [dispatchError],
  },
}) {
  return dispatchError;
}
function extractError(events = []) {
  return filterAndApply(events, "system", ["ExtrinsicFailed"], getDispatchError)[0];
}

// src/internal/foundations/devModeHelpers.ts
var logger5 = createLogger5({ name: "DevTest" });
var debug4 = logger5.debug.bind(logger5);
async function getDevProviderPath() {
  const env = getEnvironmentFromConfig();
  return env.connections
    ? env.connections[0].endpoints[0].replace("ws://", "http://")
    : vitestAutoUrl();
}
function returnSigner(options) {
  return options.signer && "privateKey" in options.signer && "type" in options.signer
    ? generateKeyringPair(options.signer.type, options.signer.privateKey)
    : options.signer;
}
function returnDefaultSigner() {
  return isEthereumDevConfig()
    ? alith
    : new Keyring({ type: "sr25519" }).addFromUri("//Alice", {
        name: "Alice default",
      });
}
async function createDevBlock(context, options, transactions) {
  const containsViem = !!(
    context.isEthereumChain &&
    context.viem() &&
    (await MoonwallContext.getContext()).providers.find((prov) => prov.type === "viem")
  );
  const api = context.polkadotJs();
  const originalBlockNumber = (await api.rpc.chain.getHeader()).number.toBigInt();
  const signer = options.signer ? returnSigner(options) : returnDefaultSigner();
  const results = [];
  const txs = !transactions ? [] : Array.isArray(transactions) ? transactions : [transactions];
  for await (const call of txs) {
    if (typeof call === "string") {
      results.push({
        type: "eth",
        hash: containsViem
          ? (
              await context.viem().request({
                method: "eth_sendRawTransaction",
                params: [call],
              })
            ).result
          : (await customWeb3Request(context.web3(), "eth_sendRawTransaction", [call])).result,
      });
    } else if (call.isSigned) {
      const tx = api.tx(call);
      debug4(
        `- Signed: ${tx.method.section}.${tx.method.method}(${tx.args.map((d) => d.toHuman()).join("; ")}) [ nonce: ${tx.nonce}]`
      );
      results.push({
        type: "sub",
        hash: (await call.send()).toString(),
      });
    } else {
      const tx = api.tx(call);
      debug4(
        `- Unsigned: ${tx.method.section}.${tx.method.method}(${tx.args.map((d) => d.toHuman()).join("; ")}) [ nonce: ${tx.nonce}]`
      );
      results.push({
        type: "sub",
        hash: (await call.signAndSend(signer)).toString(),
      });
    }
  }
  const { parentHash, finalize } = options;
  const blockResult = await createAndFinalizeBlock(api, parentHash, finalize);
  if (results.length === 0) {
    return {
      block: blockResult,
    };
  }
  const allRecords = await (await api.at(blockResult.hash)).query.system.events();
  const blockData = await api.rpc.chain.getBlock(blockResult.hash);
  const getExtIndex = (records, result2) => {
    if (result2.type === "eth") {
      const res = records
        .find(
          ({ phase, event: { section, method, data } }) =>
            phase.isApplyExtrinsic &&
            section === "ethereum" &&
            method === "Executed" &&
            data[2].toString() === result2.hash
        )
        ?.phase?.asApplyExtrinsic?.toString();
      return typeof res === "undefined" ? void 0 : Number(res);
    }
    return blockData.block.extrinsics.findIndex((ext) => ext.hash.toHex() === result2.hash);
  };
  const result = results.map((result2) => {
    const extrinsicIndex = getExtIndex(allRecords, result2);
    const extrinsicFound = typeof extrinsicIndex !== "undefined";
    const events = allRecords.filter(
      ({ phase }) =>
        phase.isApplyExtrinsic && Number(phase.asApplyExtrinsic.toString()) === extrinsicIndex
    );
    const failure = extractError(events);
    return {
      extrinsic: extrinsicFound ? blockData.block.extrinsics[extrinsicIndex] : null,
      events,
      error:
        failure &&
        ((failure.isModule && api.registry.findMetaError(failure.asModule)) || {
          name: failure.toString(),
        }),
      successful: extrinsicFound && !failure,
      hash: result2.hash,
    };
  });
  if (results.find((res) => res.type === "eth")) {
    for (let i = 0; i < 1e3; i++) {
      const currentBlock = (await api.rpc.chain.getHeader()).number.toBigInt();
      await setTimeout3(30);
      if (currentBlock > originalBlockNumber) {
        break;
      }
    }
  }
  const actualEvents = result.flatMap((resp) => resp.events);
  if (options.expectEvents && options.expectEvents.length > 0) {
    const match = options.expectEvents.every((eEvt) => {
      const found = actualEvents
        .map((aEvt) => eEvt.is(aEvt.event))
        .reduce((acc, curr) => acc || curr, false);
      if (!found) {
        options.logger
          ? options.logger.error(
              `Event ${chalk7.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            )
          : console.error(
              `Event ${chalk7.bgWhiteBright.blackBright(eEvt.meta.name)} not present in block`
            );
      }
      return found;
    });
    if (!match) {
      throw new Error("Expected events not present in block");
    }
  }
  if (!options.allowFailures) {
    for (const event of actualEvents) {
      if (api.events.system.ExtrinsicFailed.is(event.event)) {
        throw new Error(
          "ExtrinsicFailed event detected, enable 'allowFailures' if this is expected."
        );
      }
    }
  }
  return {
    block: blockResult,
    result: Array.isArray(transactions) ? result : result[0],
  };
}

// src/internal/launcherCommon.ts
init_configReader();
import chalk8 from "chalk";
import { execSync as execSync4 } from "child_process";
import fs10 from "fs";
import path9 from "path";
import Docker3 from "dockerode";
import { select as select3 } from "@inquirer/prompts";
async function commonChecks(env) {
  const globalConfig = await importAsyncConfig();
  if (env.foundation.type === "dev") {
    await devBinCheck(env);
  }
  if (env.foundation.type === "zombie") {
    await zombieBinCheck(env);
  }
  if (
    process.env.MOON_RUN_SCRIPTS === "true" &&
    globalConfig.scriptsDir &&
    env.runScripts &&
    env.runScripts.length > 0
  ) {
    for (const scriptCommand of env.runScripts) {
      await executeScript(scriptCommand);
    }
  }
}
async function zombieBinCheck(env) {
  if (env.foundation.type !== "zombie") {
    throw new Error("This function is only for zombie environments");
  }
  const bins = parseZombieConfigForBins(env.foundation.zombieSpec.configPath);
  const pids = bins.flatMap((bin) => checkAlreadyRunning(bin));
  pids.length === 0 || process.env.CI || (await promptAlreadyRunning(pids));
}
async function devBinCheck(env) {
  if (env.foundation.type !== "dev") {
    throw new Error("This function is only for dev environments");
  }
  if (!env.foundation.launchSpec || !env.foundation.launchSpec[0]) {
    throw new Error("Dev environment requires a launchSpec configuration");
  }
  if (env.foundation.launchSpec[0].useDocker) {
    const docker = new Docker3();
    const imageName = env.foundation.launchSpec[0].binPath;
    console.log(`Checking if ${imageName} is running...`);
    const matchingContainers = (
      await docker.listContainers({
        filters: { ancestor: [imageName] },
      })
    ).flat();
    if (matchingContainers.length === 0) {
      return;
    }
    if (!process.env.CI) {
      await promptKillContainers(matchingContainers);
      return;
    }
    const runningContainers = matchingContainers.map(({ Id, Ports }) => ({
      Id: Id.slice(0, 12),
      Ports: Ports.map(({ PublicPort, PrivatePort }) =>
        PublicPort ? `${PublicPort} -> ${PrivatePort}` : `${PrivatePort}`
      ).join(", "),
    }));
    console.table(runningContainers);
    throw new Error(`${imageName} is already running, aborting`);
  }
  const binName = path9.basename(env.foundation.launchSpec[0].binPath);
  const pids = checkAlreadyRunning(binName);
  pids.length === 0 || process.env.CI || (await promptAlreadyRunning(pids));
  await downloadBinsIfMissing(env.foundation.launchSpec[0].binPath);
}
async function promptKillContainers(matchingContainers) {
  const answer = await select3({
    message: `The following containers are already running image ${matchingContainers[0].Image}: ${matchingContainers.map(({ Id }) => Id).join(", ")}
 Would you like to kill them?`,
    choices: [
      { name: "\u{1FA93}  Kill containers", value: "kill" },
      { name: "\u{1F44B}   Quit", value: "goodbye" },
    ],
  });
  if (answer === "goodbye") {
    console.log("Goodbye!");
    process.exit(0);
  }
  if (answer === "kill") {
    const docker = new Docker3();
    for (const { Id } of matchingContainers) {
      const container = docker.getContainer(Id);
      await container.stop();
      await container.remove();
    }
    const containers = await docker.listContainers({
      filters: { ancestor: matchingContainers.map(({ Image }) => Image) },
    });
    if (containers.length > 0) {
      console.error(
        `The following containers are still running: ${containers.map(({ Id }) => Id).join(", ")}`
      );
      process.exit(1);
    }
    return;
  }
}
async function executeScript(scriptCommand, args) {
  const scriptsDir = (await importAsyncConfig()).scriptsDir;
  if (!scriptsDir) {
    throw new Error("No scriptsDir found in config");
  }
  const files = await fs10.promises.readdir(scriptsDir);
  try {
    const script = scriptCommand.split(" ")[0];
    const ext = path9.extname(script);
    const scriptPath = path9.join(process.cwd(), scriptsDir, scriptCommand);
    if (!files.includes(script)) {
      throw new Error(`Script ${script} not found in ${scriptsDir}`);
    }
    console.log(`========== Executing script: ${chalk8.bgGrey.greenBright(script)} ==========`);
    const argsString = args ? ` ${args}` : "";
    switch (ext) {
      case ".js":
        execSync4(`node ${scriptPath}${argsString}`, { stdio: "inherit" });
        break;
      case ".ts":
        execSync4(`pnpm tsx ${scriptPath}${argsString}`, { stdio: "inherit" });
        break;
      case ".sh":
        execSync4(`${scriptPath}${argsString}`, { stdio: "inherit" });
        break;
      default:
        console.log(`${ext} not supported, skipping ${script}`);
    }
  } catch (err) {
    console.error(`Error executing script: ${chalk8.bgGrey.redBright(err)}`);
    throw new Error(err);
  }
}
export {
  LaunchCommandParser,
  ProviderFactory,
  ProviderInterfaceFactory,
  checkAccess,
  checkAlreadyRunning,
  checkExists,
  checkListeningPorts,
  checkZombieBins,
  clearNodeLogs,
  commonChecks,
  createChopsticksBlock,
  createConfig,
  createDevBlock,
  createFolders,
  createSampleConfig,
  deriveTestIds,
  downloadBinsIfMissing,
  downloader,
  executeScript,
  fetchArtifact,
  generateConfig,
  getDevProviderPath,
  getFreePort,
  getVersions,
  getWsFromConfig,
  getWsUrlFromConfig,
  getZombieConfig,
  initializeProgressBar,
  launchNode,
  parseChopsticksRunCmd,
  parseZombieCmd,
  promptAlreadyRunning,
  reportLogLocation,
  runTask,
  sendIpcMessage,
  sendNewBlockAndCheck,
  sendNewBlockRequest,
  sendSetHeadRequest,
  sendSetStorageRequest,
  spawnTask,
  vitestAutoUrl,
  withTimeout,
};
