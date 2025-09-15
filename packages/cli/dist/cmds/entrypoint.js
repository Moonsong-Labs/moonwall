var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) =>
  function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res;
  };
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
};

// src/internal/logging.ts
var originalWrite, blockList;
var init_logging = __esm({
  "src/internal/logging.ts"() {
    "use strict";
    originalWrite = process.stderr.write.bind(process.stderr);
    blockList = [
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
  },
});

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
var init_downloader = __esm({
  "src/internal/cmdFunctions/downloader.ts"() {
    "use strict";
  },
});

// src/internal/processHelpers.ts
import child_process from "child_process";
import { promisify } from "util";
import { createLogger } from "@moonwall/util";
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
var logger, debug, execAsync, withTimeout;
var init_processHelpers = __esm({
  "src/internal/processHelpers.ts"() {
    "use strict";
    logger = createLogger({ name: "actions:runner" });
    debug = logger.debug.bind(logger);
    execAsync = promisify(child_process.exec);
    withTimeout = (promise, ms) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Operation timed out")), ms)),
      ]);
    };
  },
});

// src/lib/repoDefinitions/moonbeam.ts
var repo, moonbeam_default;
var init_moonbeam = __esm({
  "src/lib/repoDefinitions/moonbeam.ts"() {
    "use strict";
    repo = {
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
    moonbeam_default = repo;
  },
});

// src/lib/repoDefinitions/polkadot.ts
var repo2, polkadot_default;
var init_polkadot = __esm({
  "src/lib/repoDefinitions/polkadot.ts"() {
    "use strict";
    repo2 = {
      name: "polkadot",
      binaries: [
        { name: "polkadot" },
        { name: "polkadot-prepare-worker" },
        { name: "polkadot-execute-worker" },
      ],
      ghAuthor: "paritytech",
      ghRepo: "polkadot-sdk",
    };
    polkadot_default = repo2;
  },
});

// src/lib/repoDefinitions/tanssi.ts
var repo3, tanssi_default;
var init_tanssi = __esm({
  "src/lib/repoDefinitions/tanssi.ts"() {
    "use strict";
    repo3 = {
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
    tanssi_default = repo3;
  },
});

// src/lib/configReader.ts
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
var init_repoDefinitions = __esm({
  "src/lib/repoDefinitions/index.ts"() {
    "use strict";
    init_moonbeam();
    init_polkadot();
    init_tanssi();
    init_configReader();
  },
});

// src/internal/cmdFunctions/fetchArtifact.ts
import fs2 from "fs/promises";
import path2 from "path";
import semver from "semver";
import chalk from "chalk";
import { minimatch } from "minimatch";
import { execSync } from "child_process";
import { Octokit } from "@octokit/rest";
import { confirm } from "@inquirer/prompts";
async function fetchArtifact(args) {
  if (args.path && (await fs2.access(args.path).catch(() => true))) {
    console.log("Folder not exists, creating");
    fs2.mkdir(args.path);
  }
  const checkOverwrite = async (path12) => {
    try {
      await fs2.access(path12, fs2.constants.R_OK);
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
var octokit;
var init_fetchArtifact = __esm({
  "src/internal/cmdFunctions/fetchArtifact.ts"() {
    "use strict";
    init_processHelpers();
    init_downloader();
    init_repoDefinitions();
    init_configReader();
    octokit = new Octokit({
      baseUrl: "https://api.github.com",
      log: {
        debug: () => {},
        info: () => {},
        warn: console.warn,
        error: console.error,
      },
    });
  },
});

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
var sampleTest;
var init_initialisation = __esm({
  "src/internal/cmdFunctions/initialisation.ts"() {
    "use strict";
    sampleTest = `import { describeSuite, expect } from "@moonwall/cli";

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
  },
});

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
var init_tempLogs = __esm({
  "src/internal/cmdFunctions/tempLogs.ts"() {
    "use strict";
  },
});

// src/internal/cmdFunctions/index.ts
var init_cmdFunctions = __esm({
  "src/internal/cmdFunctions/index.ts"() {
    "use strict";
    init_downloader();
    init_fetchArtifact();
    init_initialisation();
    init_tempLogs();
  },
});

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
var LaunchCommandParser, isPortAvailable, getNextAvailablePort, getFreePort;
var init_commandParsers = __esm({
  "src/internal/commandParsers.ts"() {
    "use strict";
    init_repoDefinitions();
    LaunchCommandParser = class _LaunchCommandParser {
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
          invariant(
            forkOptions.url.startsWith("http"),
            "Fork URL must start with http:// or https://"
          );
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
    isPortAvailable = async (port) => {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.once("close", () => resolve(true));
          server.close();
        });
        server.on("error", () => resolve(false));
      });
    };
    getNextAvailablePort = async (startPort) => {
      let port = startPort;
      while (port <= 65535) {
        if (await isPortAvailable(port)) {
          return port;
        }
        port++;
      }
      throw new Error(`No available ports found starting from ${startPort}`);
    };
    getFreePort = async () => {
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
  },
});

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
var init_deriveTestIds = __esm({
  "src/internal/deriveTestIds.ts"() {
    "use strict";
  },
});

// src/internal/fileCheckers.ts
import fs6 from "fs";
import { execSync as execSync2 } from "child_process";
import chalk4 from "chalk";
import os from "os";
import path6 from "path";
import { select as select2 } from "@inquirer/prompts";
async function checkExists(path12) {
  const binPath = path12.split(" ")[0];
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
function checkAccess(path12) {
  const binPath = path12.split(" ")[0];
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
var init_fileCheckers = __esm({
  "src/internal/fileCheckers.ts"() {
    "use strict";
  },
});

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
function getZombieConfig(path12) {
  const fsResult = fs7.existsSync(path12);
  if (!fsResult) {
    throw new Error(
      `No ZombieConfig file found at location: ${path12} 
 Are you sure your ${chalk5.bgWhiteBright.blackBright(
   "moonwall.config.json"
 )} file has the correct "configPath" in zombieSpec?`
    );
  }
  const buffer = fs7.readFileSync(path12, "utf-8");
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
var init_zombieHelpers = __esm({
  "src/internal/foundations/zombieHelpers.ts"() {
    "use strict";
    init_fileCheckers();
  },
});

// src/internal/localNode.ts
import { exec, spawn, spawnSync } from "child_process";
import fs8 from "fs";
import path7 from "path";
import WebSocket from "ws";
import { createLogger as createLogger2 } from "@moonwall/util";
import { setTimeout as timer2 } from "timers/promises";
import util from "util";
import Docker from "dockerode";
import invariant3 from "tiny-invariant";
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
var execAsync2, logger2, debug2;
var init_localNode = __esm({
  "src/internal/localNode.ts"() {
    "use strict";
    init_fileCheckers();
    init_configReader();
    execAsync2 = util.promisify(exec);
    logger2 = createLogger2({ name: "localNode" });
    debug2 = logger2.debug.bind(logger2);
  },
});

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
var logger3, debug3, ProviderFactory, ProviderInterfaceFactory, vitestAutoUrl;
var init_providerFactories = __esm({
  "src/internal/providerFactories.ts"() {
    "use strict";
    logger3 = createLogger3({ name: "providers" });
    debug3 = logger3.debug.bind(logger3);
    ProviderFactory = class _ProviderFactory {
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
        return providerConfigs.map((providerConfig) =>
          new _ProviderFactory(providerConfig).create()
        );
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
    ProviderInterfaceFactory = class _ProviderInterfaceFactory {
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
          const providerInterface = await new _ProviderInterfaceFactory(
            name,
            type,
            connect
          ).create();
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
    vitestAutoUrl = () => `ws://127.0.0.1:${process.env.MOONWALL_RPC_PORT}`;
  },
});

// src/lib/globalContext.ts
var globalContext_exports = {};
__export(globalContext_exports, {
  MoonwallContext: () => MoonwallContext,
  contextCreator: () => contextCreator,
  runNetworkOnly: () => runNetworkOnly,
});
import "@moonbeam-network/api-augment";
import zombie from "@zombienet/orchestrator";
import { createLogger as createLogger4 } from "@moonwall/util";
import fs9 from "fs";
import net3 from "net";
import readline from "readline";
import { setTimeout as timer3 } from "timers/promises";
import path8 from "path";
import { ChildProcess, exec as exec2, execSync as execSync3 } from "child_process";
import { promisify as promisify2 } from "util";
import Docker2 from "dockerode";
import invariant4 from "tiny-invariant";
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
var logger4, debugSetup, MoonwallContext, contextCreator, runNetworkOnly, execAsync3;
var init_globalContext = __esm({
  "src/lib/globalContext.ts"() {
    "use strict";
    init_commandParsers();
    init_zombieHelpers();
    init_localNode();
    init_providerFactories();
    init_configReader();
    init_internal();
    logger4 = createLogger4({ name: "context" });
    debugSetup = logger4.debug.bind(logger4);
    MoonwallContext = class _MoonwallContext {
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
                  setTimeout(
                    () => reject(new Error("Connection attempt timed out")),
                    connectTimeout
                  )
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
          console.error(
            `Total providers: ${this.environment.providers.map((p) => p.name).join(", ")}`
          );
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
    contextCreator = async (options) => {
      const config = await importAsyncConfig();
      const ctx = await MoonwallContext.getContext(config, options);
      await runNetworkOnly();
      await ctx.connectEnvironment();
      return ctx;
    };
    runNetworkOnly = async () => {
      const config = await importAsyncConfig();
      const ctx = await MoonwallContext.getContext(config);
      await ctx.startNetwork();
    };
    execAsync3 = promisify2(exec2);
  },
});

// src/internal/foundations/chopsticksHelpers.ts
import "@moonbeam-network/api-augment";
import chalk6 from "chalk";
import { setTimeout as setTimeout2 } from "timers/promises";
var init_chopsticksHelpers = __esm({
  "src/internal/foundations/chopsticksHelpers.ts"() {
    "use strict";
    init_globalContext();
  },
});

// src/lib/contextHelpers.ts
import "@moonbeam-network/api-augment";
var init_contextHelpers = __esm({
  "src/lib/contextHelpers.ts"() {
    "use strict";
  },
});

// src/internal/foundations/devModeHelpers.ts
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
var logger5, debug4;
var init_devModeHelpers = __esm({
  "src/internal/foundations/devModeHelpers.ts"() {
    "use strict";
    init_configReader();
    init_contextHelpers();
    init_globalContext();
    init_providerFactories();
    logger5 = createLogger5({ name: "DevTest" });
    debug4 = logger5.debug.bind(logger5);
  },
});

// src/internal/foundations/index.ts
var init_foundations = __esm({
  "src/internal/foundations/index.ts"() {
    "use strict";
    init_chopsticksHelpers();
    init_devModeHelpers();
    init_zombieHelpers();
  },
});

// src/internal/launcherCommon.ts
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
var init_launcherCommon = __esm({
  "src/internal/launcherCommon.ts"() {
    "use strict";
    init_configReader();
    init_fileCheckers();
  },
});

// src/internal/index.ts
var init_internal = __esm({
  "src/internal/index.ts"() {
    "use strict";
    init_logging();
    init_cmdFunctions();
    init_commandParsers();
    init_deriveTestIds();
    init_fileCheckers();
    init_foundations();
    init_launcherCommon();
    init_localNode();
    init_processHelpers();
    init_providerFactories();
  },
});

// src/cmds/entrypoint.ts
init_internal();
import "@moonbeam-network/api-augment";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// src/cmds/main.ts
import chalk12 from "chalk";
import clear2 from "clear";
import colors from "colors";
import fs12 from "fs";
import cfonts from "cfonts";
import path11 from "path";
import { SemVer, lt } from "semver";

// package.json
var package_default = {
  name: "@moonwall/cli",
  type: "module",
  version: "5.13.5",
  description: "Testing framework for the Moon family of projects",
  author: "timbrinded",
  license: "ISC",
  homepage: "https://github.com/Moonsong-Labs/moonwall#readme",
  repository: {
    type: "git",
    url: "git+https://github.com/Moonsong-Labs/moonwall.git",
    directory: "packages/cli",
  },
  bugs: {
    url: "https://github.com/Moonsong-Labs/moonwall/issues",
  },
  keywords: ["moonwall", "moonbeam", "moondance", "polkadot", "kusama", "substrate"],
  exports: {
    ".": {
      types: "./dist/types/src/index.d.ts",
      import: "./dist/index.js",
      bun: "./src/cmds/entrypoint.ts",
    },
  },
  module: "./dist/index.js",
  types: "./dist/types/src/index.d.ts",
  bin: {
    moonwall: "./moonwall.mjs",
    moondebug: "./moondebug.mjs",
  },
  engines: {
    node: ">=20",
    pnpm: ">=7",
  },
  files: ["dist", "bin", "*.d.ts", "*.mjs"],
  scripts: {
    clean: "rm -rf dist && rm -rf node_modules",
    build: "pnpm exec rm -rf dist && tsup src --format esm --no-splitting && pnpm generate-types",
    lint: "pnpm biome lint ./src",
    "lint:fix": "pnpm biome lint ./src --apply",
    fmt: "biome format .",
    "fmt:fix": "biome format . --write",
    "generate-types": "tsc",
    watch: "tsup src --format esm --watch",
    typecheck: "pnpm exec tsc --noEmit",
    prepublish: "pnpm run build && pnpm run generate-types",
  },
  dependencies: {
    "@acala-network/chopsticks": "^1.2.0",
    "@inquirer/prompts": "^7.6.0",
    "@moonbeam-network/api-augment": "0.3700.0",
    "@moonwall/types": "workspace:*",
    "@moonwall/util": "workspace:*",
    "@octokit/rest": "22.0.0",
    "@polkadot/api": "^16.4.1",
    "@polkadot/api-derive": "^16.4.1",
    "@polkadot/keyring": "^13.5.3",
    "@polkadot/rpc-provider": "^16.4.1",
    "@polkadot/types": "^16.4.1",
    "@polkadot/types-codec": "^16.4.1",
    "@polkadot/util": "^13.5.3",
    "@polkadot/util-crypto": "^13.5.3",
    "@types/react": "19.1.8",
    "@types/tmp": "0.2.6",
    "@vitest/ui": "^3.2.4",
    "@zombienet/orchestrator": "0.0.110",
    "@zombienet/utils": "^0.0.29",
    bottleneck: "2.19.5",
    cfonts: "^3.3.0",
    chalk: "^5.4.1",
    clear: "0.1.0",
    "cli-progress": "3.12.0",
    colors: "1.4.0",
    dockerode: "4.0.7",
    dotenv: "17.2.0",
    ethers: "^6.15.0",
    ink: "^6.0.1",
    "jsonc-parser": "3.3.1",
    minimatch: "10.0.3",
    pino: "^9.7.0",
    "polkadot-api": "1.14.1",
    react: "^19.1.0",
    "reflect-metadata": "^0.2.0",
    semver: "^7.7.2",
    "tiny-invariant": "^1.3.3",
    tmp: "^0.2.3",
    viem: "2.31.7",
    vitest: "3.2.4",
    web3: "^4.16.0",
    "web3-providers-ws": "4.0.8",
    ws: "^8.18.3",
    yaml: "2.8.0",
    yargs: "^18.0.0",
  },
  devDependencies: {
    "@biomejs/biome": "^2.1.1",
    "@types/clear": "^0.1.4",
    "@types/cli-progress": "3.11.6",
    "@types/node": "^24.0.14",
    "@types/semver": "^7.7.0",
    "@types/ws": "^8.18.1",
    "@types/yargs": "^17.0.33",
    tsup: "^8.5.0",
    tsx: "^4.20.3",
    typescript: "5.8.3",
  },
  publishConfig: {
    access: "public",
  },
};

// src/cmds/main.ts
init_internal();
init_configReader();
init_repoDefinitions();

// src/cmds/runNetwork.tsx
import chalk11 from "chalk";
import clear from "clear";
import { promises as fsPromises2 } from "fs";
import { render } from "ink";

// src/cmds/components/LogViewer.tsx
import { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import chalk10 from "chalk";
import fs11 from "fs";

// src/cmds/runTests.ts
init_tempLogs();
init_launcherCommon();
init_configReader();
init_globalContext();
import chalk9 from "chalk";
import path10 from "path";
import { startVitest } from "vitest/node";
import { createLogger as createLogger6 } from "@moonwall/util";
var logger6 = createLogger6({ name: "runner" });
async function testCmd(envName, additionalArgs) {
  await cacheConfig();
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === envName);
  process.env.MOON_TEST_ENV = envName;
  if (additionalArgs?.shard) {
    process.env.MOONWALL_TEST_SHARD = additionalArgs.shard;
  }
  if (!env) {
    const envList = globalConfig.environments
      .map((env2) => env2.name)
      .sort()
      .join(", ");
    throw new Error(
      `No environment found in config for: ${chalk9.bgWhiteBright.blackBright(envName)}
 Environments defined in config are: ${envList}
`
    );
  }
  loadEnvVars();
  await commonChecks(env);
  if (
    (env.foundation.type === "dev" && !env.foundation.launchSpec[0].retainAllLogs) ||
    (env.foundation.type === "chopsticks" && !env.foundation.launchSpec[0].retainAllLogs)
  ) {
    clearNodeLogs();
  }
  if (env.foundation.type === "zombie") {
    process.env.MOON_EXIT = "true";
  }
  const vitest = await executeTests(env, additionalArgs);
  const failed = vitest.state
    .getFiles()
    .filter((file) => file.result && file.result.state === "fail");
  if (failed.length === 0) {
    logger6.info("\u2705 All tests passed");
    global.MOONWALL_TERMINATION_REASON = "tests finished";
    return true;
  }
  logger6.warn("\u274C Some tests failed");
  global.MOONWALL_TERMINATION_REASON = "tests failed";
  return false;
}
async function executeTests(env, testRunArgs2) {
  return new Promise(async (resolve, reject) => {
    const globalConfig = await importAsyncConfig();
    if (env.foundation.type === "read_only") {
      try {
        if (!process.env.MOON_TEST_ENV) {
          throw new Error("MOON_TEST_ENV not set");
        }
        const ctx = await contextCreator();
        const chainData = ctx.providers
          .filter((provider) => provider.type === "polkadotJs" && provider.name.includes("para"))
          .map((provider) => {
            return {
              [provider.name]: {
                rtName: provider.greet().rtName,
                rtVersion: provider.greet().rtVersion,
              },
            };
          });
        if (chainData.length < 1) {
          throw "Could not read runtime name or version \nTo fix: ensure moonwall config has a polkadotJs provider with a name containing 'para'";
        }
        const { rtVersion, rtName } = Object.values(chainData[0])[0];
        process.env.MOON_RTVERSION = rtVersion;
        process.env.MOON_RTNAME = rtName;
      } catch (e) {
        logger6.error(e);
      } finally {
        await MoonwallContext.destroy();
      }
    }
    const additionalArgs = { ...testRunArgs2 };
    const vitestOptions = testRunArgs2?.vitestPassthroughArgs?.reduce((acc, arg) => {
      const [key, value] = arg.split("=");
      return {
        // biome-ignore lint/performance/noAccumulatingSpread: this is fine
        ...acc,
        [key]: Number(value) || value,
      };
    }, {});
    if (env.skipTests && env.skipTests.length > 0) {
      additionalArgs.testNamePattern = `^((?!${env.skipTests?.map((test) => `${test.name}`).join("|")}).)*$`;
    }
    const options = new VitestOptionsBuilder()
      .setReporters(env.reporters || ["default"])
      .setOutputFile(env.reportFile)
      .setName(env.name)
      .setTimeout(env.timeout || globalConfig.defaultTestTimeout)
      .setInclude(env.include || ["**/*{test,spec,test_,test-}*{ts,mts,cts}"])
      .addThreadConfig(env.multiThreads)
      .addVitestPassthroughArgs(env.vitestArgs)
      .build();
    if (
      globalConfig.environments.find((env2) => env2.name === process.env.MOON_TEST_ENV)?.foundation
        .type === "zombie"
    ) {
      await runNetworkOnly();
      process.env.MOON_RECYCLE = "true";
    }
    try {
      const testFileDir =
        additionalArgs?.subDirectory !== void 0
          ? env.testFileDir.map((folder) =>
              path10.join(folder, additionalArgs.subDirectory || "error")
            )
          : env.testFileDir;
      const folders = testFileDir.map((folder) => path10.join(".", folder, "/"));
      const optionsToUse = {
        ...options,
        ...additionalArgs,
        ...vitestOptions,
      };
      if (env.printVitestOptions) {
        logger6.info(`Options to use: ${JSON.stringify(optionsToUse, null, 2)}`);
      }
      resolve(await startVitest("test", folders, optionsToUse));
    } catch (e) {
      logger6.error(e);
      reject(e);
    }
  });
}
var filterList = ["<empty line>", "", "stdout | unknown test"];
var VitestOptionsBuilder = class {
  options = {
    watch: false,
    globals: true,
    reporters: ["default"],
    passWithNoTests: false,
    deps: {
      optimizer: { ssr: { enabled: false }, web: { enabled: false } },
    },
    env: {
      NODE_OPTIONS: "--no-warnings --no-deprecation",
    },
    include: ["**/*{test,spec,test_,test-}*{ts,mts,cts}"],
    onConsoleLog(log) {
      if (filterList.includes(log.trim())) return false;
      if (log.includes("has multiple versions, ensure that there is only one installed.")) {
        return false;
      }
    },
  };
  setName(name) {
    this.options.name = name;
    return this;
  }
  setReporters(reporters) {
    const modified = reporters.includes("basic")
      ? reporters.map((r) => (r === "basic" ? ["default", { summary: false }] : r))
      : reporters;
    this.options.reporters = modified;
    return this;
  }
  setOutputFile(file) {
    if (!file) {
      logger6.info("No output file specified, skipping");
      return this;
    }
    this.options.outputFile = file;
    return this;
  }
  setTimeout(timeout) {
    this.options.testTimeout = timeout;
    this.options.hookTimeout = timeout;
    return this;
  }
  setInclude(include) {
    this.options.include = include;
    return this;
  }
  addVitestPassthroughArgs(args) {
    this.options = { ...this.options, ...args };
    return this;
  }
  addThreadConfig(threads = false) {
    this.options.fileParallelism = false;
    this.options.pool = "forks";
    this.options.poolOptions = {
      threads: {
        isolate: true,
        minThreads: 1,
        maxThreads: 3,
        singleThread: false,
      },
    };
    if (threads === true && process.env.MOON_RECYCLE !== "true") {
      this.options.fileParallelism = true;
    }
    if (typeof threads === "number" && process.env.MOON_RECYCLE !== "true") {
      this.options.fileParallelism = true;
      if (this.options.poolOptions?.threads) {
        this.options.poolOptions.threads.maxThreads = threads;
        this.options.poolOptions.threads.singleThread = false;
      }
    }
    if (typeof threads === "object" && process.env.MOON_RECYCLE !== "true") {
      const key = Object.keys(threads)[0];
      if (["threads", "forks", "vmThreads", "typescript"].includes(key)) {
        this.options.pool = key;
        this.options.poolOptions = Object.values(threads)[0];
      } else {
        throw new Error(`Invalid pool type: ${key}`);
      }
    }
    return this;
  }
  build() {
    return this.options;
  }
};

// src/cmds/components/LogViewer.tsx
import tmp from "tmp";
import { jsx, jsxs } from "react/jsx-runtime";
var LogViewer = ({ env, logFilePath, onExit, onNextLog, onPrevLog, zombieInfo }) => {
  const [logs, setLogs] = useState([]);
  const [testOutput, setTestOutput] = useState([]);
  const [parsedOutput, setParsedOutput] = useState();
  const [tailing, setTailing] = useState(true);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [isGrepMode, setIsGrepMode] = useState(false);
  const [grepInput, setGrepInput] = useState(process.env.MOON_GREP || "D01T01");
  const [showCursor, setShowCursor] = useState(true);
  const [tmpFile] = useState(() => {
    const tmpobj = tmp.fileSync({ prefix: "moonwall-test-", postfix: ".json" });
    return tmpobj.name;
  });
  const [testScrollOffset, setTestScrollOffset] = useState(0);
  const maxVisibleLines = process.stdout.rows - 6;
  const { exit } = useApp();
  useEffect(() => {
    const hideCursor = () => {
      process.stdout.write("\x1B[?25l");
    };
    hideCursor();
    setupWatcher();
    const cursorCheck = setInterval(hideCursor, 100);
    return () => {
      clearInterval(cursorCheck);
      process.stdout.write("\x1B[?25h");
    };
  }, []);
  const readLog = useCallback(() => {
    if (!tailing || !fs11.existsSync(logFilePath)) return;
    try {
      const fileContent = fs11.readFileSync(logFilePath, "utf-8");
      const lines = fileContent
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => line.trimEnd());
      setLogs(lines);
    } catch (error) {
      console.error("Error in readLog:", error);
    }
  }, [tailing, logFilePath]);
  const setupWatcher = useCallback(() => {
    readLog();
    fs11.watchFile(logFilePath, { interval: 100 }, (curr, prev) => {
      if (curr.size !== prev.size) {
        readLog();
      }
    });
  }, [logFilePath, readLog]);
  const removeWatcher = useCallback(() => {
    fs11.unwatchFile(logFilePath);
  }, [logFilePath]);
  const handleGrepSubmit = useCallback(async () => {
    setTestOutput([]);
    setParsedOutput(void 0);
    process.env.MOON_RECYCLE = "true";
    process.env.MOON_GREP = grepInput;
    const opts = {
      testNamePattern: grepInput,
      silent: false,
      subDirectory: process.env.MOON_SUBDIR,
      outputFile: tmpFile,
      reporters: ["dot", "json"],
      onConsoleLog: (log) => {
        if (!log.includes("has multiple versions, ensure that there is only one installed.")) {
          setTestOutput((prev) => [...prev, log]);
        }
        return false;
      },
    };
    setIsExecutingCommand(true);
    try {
      await executeTests(env, opts);
      const jsonOutput = JSON.parse(fs11.readFileSync(tmpFile, "utf-8"));
      setParsedOutput(jsonOutput);
    } catch (error) {
      setTestOutput((prev) => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsExecutingCommand(false);
      setIsGrepMode(false);
      if (tailing) {
        setupWatcher();
      }
    }
  }, [grepInput, env, tailing]);
  const handleTest = useCallback(async () => {
    setTestOutput([]);
    setParsedOutput(void 0);
    process.env.MOON_RECYCLE = "true";
    const opts = {
      silent: false,
      subDirectory: process.env.MOON_SUBDIR,
      outputFile: tmpFile,
      reporters: ["dot", "json"],
      onConsoleLog: (log) => {
        if (!log.includes("has multiple versions, ensure that there is only one installed.")) {
          setTestOutput((prev) => [...prev, log]);
        }
        return false;
      },
    };
    setIsExecutingCommand(true);
    try {
      await executeTests(env, opts);
      const jsonOutput = JSON.parse(fs11.readFileSync(tmpFile, "utf-8"));
      setParsedOutput(jsonOutput);
    } catch (error) {
      setTestOutput((prev) => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsExecutingCommand(false);
      if (tailing) {
        setupWatcher();
      }
    }
  }, [env, tailing, setupWatcher]);
  useInput((input5, key) => {
    if (isGrepMode) {
      if (key.return) {
        handleGrepSubmit();
      } else if (key.escape) {
        setIsGrepMode(false);
      } else if (key.backspace || key.delete) {
        setGrepInput((prev) => prev.slice(0, -1));
      } else if (input5 && !key.ctrl && !key.meta) {
        setGrepInput((prev) => prev + input5);
      }
      return;
    }
    if (input5 === "q") {
      fs11.unwatchFile(logFilePath);
      onExit();
      exit();
    }
    if (input5 === "p") {
      setTailing(false);
      removeWatcher();
    }
    if (input5 === "r") {
      setTailing(true);
      setupWatcher();
      readLog();
    }
    if (input5 === "t") {
      handleTest();
    }
    if (input5 === "g") {
      setIsGrepMode(true);
    }
    if (input5 === "," && onNextLog) {
      fs11.unwatchFile(logFilePath);
      onNextLog();
      exit();
    }
    if (input5 === "." && onPrevLog) {
      fs11.unwatchFile(logFilePath);
      onPrevLog();
      exit();
    }
    if (key.upArrow && testOutput.length > 0) {
      setTestScrollOffset((prev) =>
        Math.min(prev + 1, Math.max(0, testOutput.length - maxVisibleLines))
      );
    }
    if (key.downArrow && testOutput.length > 0) {
      setTestScrollOffset((prev) => Math.max(0, prev - 1));
    }
    if (input5 === "g") {
      setTestScrollOffset(0);
    }
  });
  useEffect(() => {
    const timer4 = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => {
      clearInterval(timer4);
    };
  }, [isGrepMode]);
  useEffect(() => {
    const stream = fs11.createReadStream(logFilePath);
    let content = "";
    stream.on("data", (chunk) => {
      content += chunk.toString();
    });
    stream.on("end", () => {
      const lines = content.split("\n").filter((line) => line.trim());
      setLogs(lines);
    });
    if (tailing) {
      setupWatcher();
    }
    return () => {
      removeWatcher();
    };
  }, [logFilePath, tailing]);
  useEffect(() => {
    setTestScrollOffset(0);
  }, [testOutput.length]);
  return /* @__PURE__ */ jsxs(Box, {
    flexDirection: "column",
    height: process.stdout.rows - 1,
    children: [
      /* @__PURE__ */ jsxs(Box, {
        flexDirection: "row",
        flexGrow: 1,
        children: [
          /* @__PURE__ */ jsxs(Box, {
            flexDirection: "column",
            width: testOutput.length > 0 ? "60%" : "100%",
            borderStyle: "round",
            borderColor: "blue",
            height: process.stdout.rows - 3,
            children: [
              /* @__PURE__ */ jsx(Box, {
                paddingX: 1,
                children: /* @__PURE__ */ jsx(Text, {
                  backgroundColor: "blue",
                  color: "black",
                  bold: true,
                  children: " " + logFilePath.split("/").slice(-2).join("/") + " ",
                }),
              }),
              /* @__PURE__ */ jsx(Box, {
                flexGrow: 1,
                flexDirection: "column",
                padding: 1,
                children: logs
                  .slice(-Math.max(1, maxVisibleLines))
                  .map((line, i) => /* @__PURE__ */ jsx(Text, { wrap: "wrap", children: line }, i)),
              }),
            ],
          }),
          testOutput.length > 0 &&
            /* @__PURE__ */ jsxs(Box, {
              flexDirection: "column",
              width: "40%",
              borderStyle: "round",
              borderColor: "yellow",
              height: process.stdout.rows - 3,
              children: [
                /* @__PURE__ */ jsx(Box, {
                  paddingX: 1,
                  children: /* @__PURE__ */ jsx(Text, {
                    backgroundColor: "yellow",
                    color: "black",
                    bold: true,
                    children: " Test Output ",
                  }),
                }),
                /* @__PURE__ */ jsxs(Box, {
                  flexDirection: "column",
                  padding: 1,
                  height: process.stdout.rows - 5,
                  children: [
                    /* @__PURE__ */ jsx(Box, {
                      flexGrow: 1,
                      flexDirection: "column",
                      overflow: "hidden",
                      children: testOutput
                        .map((line, i) =>
                          /* @__PURE__ */ jsx(Text, { wrap: "wrap", children: line }, i)
                        )
                        .slice(testScrollOffset, testScrollOffset + maxVisibleLines),
                    }),
                    testOutput.length > maxVisibleLines &&
                      /* @__PURE__ */ jsx(Text, {
                        color: "gray",
                        children: `[${Math.round((testScrollOffset / Math.max(1, testOutput.length - maxVisibleLines)) * 100)}% scroll, use \u2191/\u2193 to scroll]`,
                      }),
                    parsedOutput &&
                      /* @__PURE__ */ jsx(Box, {
                        borderStyle: "singleDouble",
                        borderColor: !parsedOutput.success ? "red" : "green",
                        flexDirection: "column",
                        minHeight: 4,
                        children: /* @__PURE__ */ jsxs(Text, {
                          children: [
                            `${parsedOutput.numPassedTests}/${parsedOutput.numTotalTests - parsedOutput.numPendingTests} tests passed`,
                            parsedOutput.numFailedTests > 0
                              ? ` (${parsedOutput.numFailedTests} failed)`
                              : "",
                          ],
                        }),
                      }),
                  ],
                }),
              ],
            }),
        ],
      }),
      !isExecutingCommand &&
        !isGrepMode &&
        /* @__PURE__ */ jsx(Box, {
          flexDirection: "column",
          margin: 0,
          padding: 0,
          children: /* @__PURE__ */ jsxs(Text, {
            children: [
              `\u{1F4DC} Tailing Logs, commands: ${chalk10.bgWhite.black("[q]")} Quit, ${chalk10.bgWhite.black("[t]")} Test, ${chalk10.bgWhite.black("[g]")} Grep test`,
              `, ${chalk10.bgWhite.black("[p]")} Pause tail`,
              `, ${chalk10.bgWhite.black("[r]")} Resume tail`,
              zombieInfo
                ? `, ${chalk10.bgWhite.black("[,]")} Next Log, ${chalk10.bgWhite.black("[.]")} Previous Log  | CurrentLog: ${chalk10.bgWhite.black(`${zombieInfo.currentNode} (${zombieInfo.position}/${zombieInfo.total})`)}`
                : "",
              testOutput.length > maxVisibleLines && ", use \u2191/\u2193 to scroll test output",
            ],
          }),
        }),
      !isExecutingCommand &&
        isGrepMode &&
        /* @__PURE__ */ jsx(Box, {
          flexDirection: "column",
          margin: 0,
          padding: 0,
          children: /* @__PURE__ */ jsxs(Text, {
            children: [
              "Pattern to filter (ID/Title) [Enter to submit, Esc to cancel]: ",
              /* @__PURE__ */ jsx(Text, { color: "green", children: grepInput }),
              /* @__PURE__ */ jsx(Text, { color: "green", children: showCursor ? "\u258B" : " " }),
            ],
          }),
        }),
    ],
  });
};

// src/cmds/runNetwork.tsx
init_tempLogs();
init_launcherCommon();
init_configReader();
init_globalContext();
import { parse as parse2 } from "yaml";

// src/cmds/interactiveCmds/chopsticksIntCmds.ts
init_configReader();
init_globalContext();
import { promises as fsPromises } from "fs";
import { parse } from "yaml";
import { jumpBlocksChopsticks, jumpRoundsChopsticks, jumpToRoundChopsticks } from "@moonwall/util";
import { number as number2, select as select4, Separator } from "@inquirer/prompts";
import assert from "assert";
async function resolveChopsticksInteractiveCmdChoice() {
  const config = getEnvironmentFromConfig();
  if (config.foundation.type !== "chopsticks") {
    throw new Error("Only chopsticks is supported, this is a bug please raise an issue.");
  }
  const isMultiChain = config.foundation.launchSpec.length > 1;
  const promptNode = async () => {
    if (config.foundation.type !== "chopsticks") {
      throw new Error("Only chopsticks is supported, this is a bug please raise an issue.");
    }
    const nodes = config.foundation.launchSpec.map(({ name: name2 }) => name2);
    const name = await select4({
      choices: nodes,
      message: "Which network would you like to interact with? ",
    });
    return name;
  };
  const nodeSelected = isMultiChain ? await promptNode() : config.foundation.launchSpec[0].name;
  const ctx = await (await MoonwallContext.getContext()).connectEnvironment();
  const provider = ctx.providers.find((a) => a.type === "polkadotJs" && a.name === nodeSelected);
  if (!provider) {
    throw new Error(
      `Provider ${nodeSelected} not found. Verify moonwall config has matching pair of launchSpec and Connection names.`
    );
  }
  const api = provider.api;
  const ports = await Promise.all(
    config.foundation.launchSpec
      .filter(({ name }) => name === nodeSelected)
      .map(async ({ configPath }) => {
        const yaml = parse((await fsPromises.readFile(configPath)).toString());
        return yaml.port || "8000";
      })
  );
  const port = Number.parseInt(ports[0]);
  const choices = [
    { name: "\u{1F197}  Create Block", value: "createblock" },
    { name: "\u27A1\uFE0F  Create N Blocks", value: "createNBlocks" },
  ];
  const containsPallet = (polkadotJsApi, palletName) => {
    const metadata = polkadotJsApi.runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === palletName
    );
    return systemPalletIndex !== -1;
  };
  if (containsPallet(api, "ParachainStaking")) {
    choices.push(
      ...[
        { name: "\u{1F53C}  Jump To Round", value: "jumpToRound" },
        { name: "\u23EB  Jump N Rounds", value: "jumpRounds" },
      ]
    );
  }
  choices.push(...[new Separator(), { name: "\u{1F519}  Go Back", value: "back" }]);
  const cmd = await select4({
    choices,
    message: "What command would you like to run? ",
    default: "createBlock",
  });
  switch (cmd) {
    case "createblock":
      try {
        await jumpBlocksChopsticks(port, 1);
      } catch (e) {
        console.error(e.message);
      }
      break;
    case "createNBlocks": {
      try {
        const nBlocks = await number2({
          message: "How many blocks? ",
        });
        assert(typeof nBlocks === "number", "Number must be a number");
        assert(nBlocks > 0, "Number must be greater than 0");
        await jumpBlocksChopsticks(port, nBlocks);
      } catch (e) {
        console.error(e.message);
      }
      break;
    }
    case "jumpToRound": {
      try {
        const round = await number2({
          message: "Which round to jump to (in future)? ",
        });
        assert(typeof round === "number", "Number must be a number");
        assert(round > 0, "Number must be greater than 0");
        console.log("\u{1F4A4} This may take a while....");
        await jumpToRoundChopsticks(api, port, round);
      } catch (e) {
        console.error(e.message);
      }
      break;
    }
    case "jumpRounds": {
      try {
        const rounds = await number2({
          message: "How many rounds? ",
        });
        assert(typeof rounds === "number", "Number must be a number");
        assert(rounds > 0, "Number must be greater than 0");
        console.log("\u{1F4A4} This may take a while....");
        await jumpRoundsChopsticks(api, port, rounds);
      } catch (e) {
        console.error(e.message);
      }
      break;
    }
    case "back":
      break;
  }
  return;
}

// src/cmds/interactiveCmds/devIntCmds.ts
init_globalContext();
import { jumpRoundsDev, jumpToRoundDev } from "@moonwall/util";
import { Separator as Separator2, rawlist, number as number3 } from "@inquirer/prompts";
import assert2 from "assert";
async function resolveDevInteractiveCmdChoice() {
  const ctx = await (await MoonwallContext.getContext()).connectEnvironment();
  const prov = ctx.providers.find((a) => a.type === "polkadotJs");
  if (!prov) {
    throw new Error("Provider not found. This is a bug, please raise an issue.");
  }
  const api = prov.api;
  const choices = [
    { name: "\u{1F197}  Create Block", value: "createblock" },
    { name: "\u{1F195}  Create Unfinalized Block", value: "createUnfinalizedBlock" },
    { name: "\u27A1\uFE0F   Create N Blocks", value: "createNBlocks" },
  ];
  const containsPallet = (polkadotJsApi, palletName) => {
    const metadata = polkadotJsApi.runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === palletName
    );
    return systemPalletIndex !== -1;
  };
  if (containsPallet(api, "ParachainStaking")) {
    choices.push(
      ...[
        { name: "\u{1F53C}  Jump To Round", value: "jumpToRound" },
        { name: "\u23EB  Jump N Rounds", value: "jumpRounds" },
      ]
    );
  }
  choices.push(...[new Separator2(), { name: "\u{1F519}  Go Back", value: "back" }]);
  const choice = await rawlist({
    choices,
    message: "What command would you like to run? ",
  });
  switch (choice) {
    case "createblock":
      try {
        await api.rpc.engine.createBlock(true, true);
      } catch (e) {
        console.error(e);
      }
      break;
    case "createUnfinalizedBlock":
      try {
        await api.rpc.engine.createBlock(true, false);
      } catch (e) {
        console.error(e);
      }
      break;
    case "createNBlocks": {
      try {
        const result = await number3({
          message: "How many blocks? ",
        });
        assert2(typeof result === "number", "result should be a number");
        assert2(result > 0, "result should be greater than 0");
        const executeSequentially = async (remaining) => {
          if (remaining === 0) {
            return;
          }
          await api.rpc.engine.createBlock(true, true);
          await executeSequentially(remaining - 1);
        };
        await executeSequentially(result);
      } catch (e) {
        console.error(e);
      }
      break;
    }
    case "jumpToRound": {
      try {
        const round = await number3({
          message: "Which round to jump to (in future)? ",
        });
        assert2(typeof round === "number", "round should be a number");
        assert2(round > 0, "round should be greater than 0");
        await jumpToRoundDev(api, round);
      } catch (e) {
        console.error(e);
      }
      break;
    }
    case "jumpRounds": {
      try {
        const rounds = await number3({
          message: "How many rounds? ",
        });
        assert2(typeof rounds === "number", "rounds should be a number");
        assert2(rounds > 0, "rounds should be greater than 0");
        await jumpRoundsDev(api, rounds);
      } catch (e) {
        console.error(e);
      }
      break;
    }
    case "back":
      break;
  }
  return;
}

// src/cmds/interactiveCmds/zombieIntCmds.ts
init_zombieHelpers();
import { input as input2, select as select5, Separator as Separator3 } from "@inquirer/prompts";
async function resolveZombieInteractiveCmdChoice() {
  const cmd = await select5({
    choices: [
      { name: "\u267B\uFE0F  Restart Node", value: "restart" },
      { name: "\u{1F5E1}\uFE0F  Kill Node", value: "kill" },
      new Separator3(),
      { name: "\u{1F519}  Go Back", value: "back" },
    ],
    message: "What command would you like to run? ",
    default: "back",
  });
  if (cmd === "back") {
    return;
  }
  const whichNode = await input2({
    message: `Which node would you like to ${cmd}? `,
  });
  try {
    await sendIpcMessage({
      cmd,
      nodeName: whichNode,
      text: `Running ${cmd} on ${whichNode}`,
    });
  } catch (e) {
    console.error("Error: ");
    console.error(e.message);
  }
  return;
}

// src/cmds/runNetwork.tsx
import {
  confirm as confirm4,
  input as input3,
  select as select6,
  Separator as Separator4,
} from "@inquirer/prompts";
import { jsx as jsx2 } from "react/jsx-runtime";
var lastSelected = 0;
async function runNetworkCmd(args) {
  await cacheConfig();
  process.env.MOON_TEST_ENV = args.envName;
  if (args.subDirectory) {
    process.env.MOON_SUBDIR = args.subDirectory;
  }
  const globalConfig = await importAsyncConfig();
  const env = globalConfig.environments.find(({ name }) => name === args.envName);
  if (!env) {
    const envList = globalConfig.environments
      .map((env2) => env2.name)
      .sort()
      .join(", ");
    throw new Error(
      `No environment found in config for: ${chalk11.bgWhiteBright.blackBright(args.envName)}
 Environments defined in config are: ${envList}
`
    );
  }
  loadEnvVars();
  await commonChecks(env);
  const testFileDirs = env.testFileDir;
  const foundation = env.foundation.type;
  if (
    (env.foundation.type === "dev" && !env.foundation.launchSpec[0].retainAllLogs) ||
    (env.foundation.type === "chopsticks" && !env.foundation.launchSpec[0].retainAllLogs)
  ) {
    clearNodeLogs();
  }
  await runNetworkOnly();
  clear();
  const portsList = await reportServicePorts();
  reportLogLocation();
  for (const { port } of portsList) {
    console.log(
      `  \u{1F5A5}\uFE0F   https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A${port}`
    );
  }
  if (process.env.MOON_SUBDIR) {
    console.log(
      chalk11.bgWhite.blackBright(`\u{1F4CD} Subdirectory Filter: ${process.env.MOON_SUBDIR}`)
    );
  }
  if (!args.GrepTest) {
    await input3({ message: "\u2705  Press any key to continue...\n" });
  } else {
    process.env.MOON_RECYCLE = "true";
    process.env.MOON_GREP = args.GrepTest;
    await executeTests(env, { testNamePattern: args.GrepTest, subDirectory: args.subDirectory });
  }
  mainloop: for (;;) {
    const menuChoice = await select6({
      message: `Environment : ${chalk11.bgGray.cyanBright(args.envName)}
Please select a choice: `,
      default: () => lastSelected,
      pageSize: 10,
      choices: [
        {
          name: "Tail:      Print the logs of the current running node to this console",
          value: 1,
          short: "tail",
        },
        {
          name: `Info:      Display Information about this environment ${args.envName}`,
          value: 2,
          short: "info",
        },
        {
          name:
            foundation === "dev" || foundation === "chopsticks" || foundation === "zombie"
              ? `Command:   Run command on network (${chalk11.bgGrey.cyanBright(foundation)})`
              : chalk11.dim(
                  `Not applicable for foundation type (${chalk11.bgGrey.cyanBright(foundation)})`
                ),
          value: 3,
          short: "cmd",
          disabled: foundation !== "dev" && foundation !== "chopsticks" && foundation !== "zombie",
        },
        {
          name:
            testFileDirs.length > 0
              ? `Test:      Execute tests registered for this environment   (${chalk11.bgGrey.cyanBright(
                  testFileDirs
                )})`
              : chalk11.dim("Test:    NO TESTS SPECIFIED"),
          value: 4,
          disabled: !(testFileDirs.length > 0),
          short: "test",
        },
        {
          name:
            testFileDirs.length > 0
              ? `GrepTest:  Execute individual test(s) based on grepping the name / ID (${chalk11.bgGrey.cyanBright(
                  testFileDirs
                )})`
              : chalk11.dim("Test:    NO TESTS SPECIFIED"),
          value: 5,
          disabled: !(testFileDirs.length > 0),
          short: "grep",
        },
        new Separator4(),
        {
          name: "Quit:      Close network and quit the application",
          value: 6,
          short: "quit",
        },
      ],
    });
    const env2 = globalConfig.environments.find(({ name }) => name === args.envName);
    if (!env2) {
      throw new Error("Environment not found in config. This is an error, please raise.");
    }
    switch (menuChoice) {
      case 1:
        clear();
        await resolveTailChoice(env2);
        lastSelected = 0;
        clear();
        break;
      case 2:
        await resolveInfoChoice(env2);
        lastSelected = 1;
        break;
      case 3:
        await resolveCommandChoice();
        lastSelected = 2;
        break;
      case 4:
        await resolveTestChoice(env2);
        lastSelected = 3;
        break;
      case 5:
        await resolveGrepChoice(env2);
        lastSelected = 4;
        break;
      case 6: {
        const quit = await confirm4({
          message: "\u2139\uFE0F  Are you sure you'd like to close network and quit? \n",
          default: false,
        });
        if (quit === true) {
          break mainloop;
        }
        break;
      }
      default:
        throw new Error("invalid value");
    }
  }
  await MoonwallContext.destroy();
}
var reportServicePorts = async () => {
  const ctx = await MoonwallContext.getContext();
  const portsList = [];
  const config = getEnvironmentFromConfig();
  switch (config.foundation.type) {
    case "dev": {
      const args = ctx.environment.nodes[0].args;
      const explicitPortArg = args.find((a) => a.includes("ws-port") || a.includes("rpc-port"));
      const port = explicitPortArg ? explicitPortArg.split("=")[1] : "9944";
      portsList.push({ port, name: "dev" });
      break;
    }
    case "chopsticks": {
      portsList.push(
        ...(await Promise.all(
          config.foundation.launchSpec.map(async ({ configPath, name }) => {
            const yaml = parse2((await fsPromises2.readFile(configPath)).toString());
            return { name, port: yaml.port || "8000" };
          })
        ))
      );
      break;
    }
    case "zombie": {
      const zombieNetwork = ctx.zombieNetwork;
      if (!zombieNetwork) {
        throw new Error("Zombie network not found. This is a bug, please raise an issue.");
      }
      for (const { wsUri, name } of zombieNetwork.relay) {
        portsList.push({ name, port: wsUri.split("ws://127.0.0.1:")[1] });
      }
      for (const paraId of Object.keys(zombieNetwork.paras)) {
        for (const { wsUri, name } of zombieNetwork.paras[paraId].nodes) {
          portsList.push({ name, port: wsUri.split("ws://127.0.0.1:")[1] });
        }
      }
    }
  }
  for (const { port, name } of portsList) {
    console.log(`  \u{1F310}  Node ${name} has started, listening on ports - Websocket: ${port}`);
  }
  return portsList;
};
var resolveCommandChoice = async () => {
  const ctx = await (await MoonwallContext.getContext()).connectEnvironment();
  switch (ctx.foundation) {
    case "dev":
      await resolveDevInteractiveCmdChoice();
      break;
    case "chopsticks":
      await resolveChopsticksInteractiveCmdChoice();
      break;
    case "zombie":
      await resolveZombieInteractiveCmdChoice();
      break;
  }
};
var resolveInfoChoice = async (env) => {
  console.log(chalk11.bgWhite.blackBright("Node Launch args:"));
  console.dir((await MoonwallContext.getContext()).environment, {
    depth: null,
  });
  console.log(chalk11.bgWhite.blackBright("Launch Spec in Config File:"));
  console.dir(env, { depth: null });
  const portsList = await reportServicePorts();
  reportLogLocation();
  for (const { port } of portsList) {
    console.log(
      `  \u{1F5A5}\uFE0F   https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A${port}`
    );
  }
  if (process.env.MOON_SUBDIR) {
    console.log(
      chalk11.bgWhite.blackBright(`\u{1F4CD} Subdirectory Filter: ${process.env.MOON_SUBDIR}`)
    );
  }
};
var resolveGrepChoice = async (env, silent = false) => {
  const grep = await input3({
    message: "What pattern would you like to filter for (ID/Title): ",
    default: process.env.MOON_GREP || "D01T01",
  });
  process.env.MOON_RECYCLE = "true";
  process.env.MOON_GREP = grep;
  const opts = {
    testNamePattern: grep,
    silent,
    subDirectory: process.env.MOON_SUBDIR,
  };
  if (silent) {
    opts.reporters = ["dot"];
  }
  return await executeTests(env, opts);
};
var resolveTestChoice = async (env, silent = false) => {
  process.env.MOON_RECYCLE = "true";
  const opts = { silent, subDirectory: process.env.MOON_SUBDIR };
  if (silent) {
    opts.reporters = ["dot"];
  }
  return await executeTests(env, opts);
};
var resolveTailChoice = async (env) => {
  let zombieNodePointer = 0;
  let switchNode;
  let zombieNodes;
  if (process.env.MOON_ZOMBIE_NODES) {
    zombieNodes = process.env.MOON_ZOMBIE_NODES.split("|");
  }
  for (;;) {
    switchNode = false;
    await new Promise(async (resolve) => {
      const logFilePath = process.env.MOON_ZOMBIE_NODES
        ? `${process.env.MOON_ZOMBIE_DIR}/${zombieNodes?.[zombieNodePointer]}.log`
        : process.env.MOON_LOG_LOCATION;
      if (!logFilePath) {
        throw new Error("No log file path resolved, this should not happen. Please raise defect");
      }
      const { waitUntilExit } = render(
        /* @__PURE__ */ jsx2(LogViewer, {
          env,
          logFilePath,
          onExit: () => resolve(),
          onNextLog: zombieNodes
            ? () => {
                switchNode = true;
                zombieNodePointer = (zombieNodePointer + 1) % zombieNodes.length;
                resolve();
              }
            : void 0,
          onPrevLog: zombieNodes
            ? () => {
                switchNode = true;
                zombieNodePointer =
                  (zombieNodePointer - 1 + zombieNodes.length) % zombieNodes.length;
                resolve();
              }
            : void 0,
          zombieInfo: zombieNodes
            ? {
                currentNode: zombieNodes[zombieNodePointer],
                position: zombieNodePointer + 1,
                total: zombieNodes.length,
              }
            : void 0,
        })
      );
      await waitUntilExit();
    });
    if (!switchNode) {
      break;
    }
  }
};

// src/cmds/main.ts
import { Octokit as Octokit2 } from "@octokit/rest";
import {
  checkbox,
  confirm as confirm5,
  input as input4,
  select as select7,
  Separator as Separator5,
} from "@inquirer/prompts";
var octokit2 = new Octokit2({
  baseUrl: "https://api.github.com",
  log: {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
  },
});
async function main() {
  for (;;) {
    const globalConfig = (await configExists()) ? await importAsyncConfig() : void 0;
    clear2();
    await printIntro();
    if (await mainMenu(globalConfig)) {
      break;
    }
  }
  process.stdout.write("Goodbye! \u{1F44B}\n");
}
async function mainMenu(config) {
  const configPresent = config !== void 0;
  const menuChoice = await select7({
    message: "Main Menu - Please select one of the following:",
    default: 0,
    pageSize: 12,
    choices: !configPresent
      ? [
          {
            name: !configPresent
              ? "1) Initialise:                         Generate a new Moonwall Config File"
              : chalk12.dim(
                  "1) Initialise:                       \u2705  CONFIG ALREADY GENERATED"
                ),
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
        await input4({
          message: `\u2139\uFE0F  Test run for ${chalk12.bgWhiteBright.black(
            chosenTestEnv.envName
          )} has been completed. Press any key to continue...
`,
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
      clear2();
      const rootDir = await input4({
        message: "Enter the root testSuites directory to process:",
        default: "suites",
      });
      await deriveTestIds({ rootDir });
      await input4({
        message: `\u2139\uFE0F  Renaming task for ${chalk12.bold(
          `/${rootDir}`
        )} has been completed. Press any key to continue...
`,
      });
      return false;
    }
    default:
      throw new Error("Invalid choice");
  }
}
async function resolveExecChoice(config) {
  const scriptDir = config.scriptsDir;
  if (!scriptDir) {
    await input4({
      message: `\u2139\uFE0F  No scriptDir property defined at ${chalk12.bgWhiteBright.black(
        "moonwall.config.json"
      )}
 Press any key to continue...
`,
    });
    return false;
  }
  if (!fs12.existsSync(scriptDir)) {
    await input4({
      message: `\u2139\uFE0F  No scriptDir found at at ${chalk12.bgWhiteBright.black(
        path11.join(process.cwd(), scriptDir)
      )}
 Press any key to continue...
`,
    });
    return false;
  }
  const files = await fs12.promises.readdir(scriptDir);
  if (!files) {
    await input4({
      message: `\u2139\uFE0F  No scripts found at ${chalk12.bgWhiteBright.black(
        path11.join(process.cwd(), config.scriptsDir || "")
      )}
 Press any key to continue...
`,
    });
  }
  const choices = files.map((file) => {
    const ext = getExtString(file);
    return { name: `${ext}:    ${path11.basename(file, "")}`, value: file };
  });
  for (;;) {
    const selections = await checkbox({
      message:
        "Select which scripts you'd like to run (press \u21A9\uFE0F with none selected to go \u{1F519})\n",
      choices,
    });
    if (selections.length === 0) {
      const noneSelected = await confirm5({
        message: "No scripts have been selected to run, do you wish to exit?",
        default: true,
      });
      if (noneSelected) {
        return false;
      }
      continue;
    }
    for (const script of selections) {
      const args = await input4({
        message: `Enter any arguments for ${chalk12.bgWhiteBright.black(
          script
        )} (press enter for none)`,
      });
      await executeScript(script, args);
    }
    await input4({
      message: "Press any key to continue...\n",
    });
    return false;
  }
}
async function resolveDownloadChoice() {
  const repos = (await configExists()) ? await allReposAsync() : standardRepos();
  const binList = repos.reduce((acc, curr) => {
    acc.push(...curr.binaries.flatMap((bin) => bin.name));
    acc.push(new Separator5());
    acc.push("Back");
    acc.push(new Separator5());
    return acc;
  }, []);
  for (;;) {
    const firstChoice = await select7({
      message: "Download - which artifact?",
      choices: binList,
    });
    if (firstChoice === "Back") {
      return;
    }
    const versions = await getVersions(firstChoice, firstChoice.includes("runtime"));
    const chooseversion = await select7({
      default: "latest",
      message: "Download - which version?",
      choices: [...versions, new Separator5(), "Back", new Separator5()],
    });
    if (chooseversion === "Back") {
      continue;
    }
    const chooseLocation = await input4({
      message: "Download - where would you like it placed?",
      default: "./tmp",
    });
    const result = await confirm5({
      message: `You are about to download ${chalk12.bgWhite.blackBright(
        firstChoice
      )} v-${chalk12.bgWhite.blackBright(chooseversion)} to: ${chalk12.bgWhite.blackBright(
        chooseLocation
      )}.
 Would you like to continue? `,
      default: true,
    });
    if (result === false) {
      continue;
    }
    await fetchArtifact({
      bin: firstChoice,
      ver: chooseversion,
      path: chooseLocation,
    });
    return;
  }
}
var chooseTestEnv = async (config) => {
  const envs = config.environments
    .map((a) => ({
      name: `[${a.foundation.type}] ${a.name}${a.description ? `: 		${a.description}` : ""}`,
      value: a.name,
      disabled: false,
    }))
    .sort((a, b) => (a.name > b.name ? -1 : 1));
  envs.push(...[new Separator5(), { name: "Back", value: "back" }, new Separator5()]);
  const envName = await select7({
    message: "Select a environment to run",
    pageSize: 12,
    choices: envs,
  });
  return { envName };
};
var chooseRunEnv = async (config) => {
  const envs = config.environments.map((a) => {
    const result = { name: "", value: a.name, disabled: false };
    if (
      a.foundation.type === "dev" ||
      a.foundation.type === "chopsticks" ||
      a.foundation.type === "zombie"
    ) {
      result.name = `[${a.foundation.type}] ${a.name}${a.description ? `: 		${a.description}` : ""}`;
    } else {
      result.name = chalk12.dim(`[${a.foundation.type}] ${a.name}     NO NETWORK TO RUN`);
      result.disabled = true;
    }
    return result;
  });
  const choices = [
    ...envs.filter(({ disabled }) => disabled === false).sort((a, b) => (a.name > b.name ? 1 : -1)),
    new Separator5(),
    ...envs.filter(({ disabled }) => disabled === true).sort((a, b) => (a.name > b.name ? 1 : -1)),
    new Separator5(),
    { name: "Back", value: "back" },
    new Separator5(),
  ];
  const envName = await select7({
    message: "Select a environment to run",
    pageSize: 12,
    choices,
  });
  return { envName };
};
var resolveQuitChoice = async () => {
  const result = await confirm5({
    message: "Are you sure you want to Quit?",
    default: false,
  });
  return result;
};
var printIntro = async () => {
  const currentVersion = new SemVer(package_default.version);
  let remoteVersion = "";
  try {
    const releases = await octokit2.rest.repos.listReleases({
      owner: "moonsong-labs",
      repo: "moonwall",
    });
    if (releases.status !== 200 || releases.data.length === 0) {
      throw new Error("No releases found for moonsong-labs.moonwall, try again later.");
    }
    const json = releases.data;
    remoteVersion =
      json.find((a) => a.tag_name.includes("@moonwall/cli@"))?.tag_name.split("@")[2] || "unknown";
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
  const formattedDivider = `${colors.rainbow("=".repeat(leftPadding))}${chalk12.bgCyan.grey(versionText)}${colors.rainbow("=".repeat(rightPadding))}
`;
  console.log(formattedDivider);
};
var getExtString = (file) => {
  const ext = path11.extname(file);
  switch (ext) {
    case ".js":
      return chalk12.bgYellow.black(ext);
    case ".ts":
      return chalk12.bgBlue.black(ext);
    case ".sh":
      return chalk12.bgGreen.black(ext);
    default:
      return chalk12.bgRed.black(ext);
  }
};

// src/cmds/entrypoint.ts
init_configReader();
dotenv.config();
function handleCursor() {
  const hideCursor = "\x1B[?25l";
  const showCursor = "\x1B[?25h";
  process.stdout.write(hideCursor);
  process.on("exit", () => {
    process.stdout.write(showCursor);
  });
  process.on("SIGINT", async () => {
    process.stdout.write(showCursor);
    global.MOONWALL_TERMINATION_REASON = "cancelled by user";
    const { MoonwallContext: MoonwallContext2 } = await Promise.resolve().then(
      () => (init_globalContext(), globalContext_exports)
    );
    await MoonwallContext2.destroy("cancelled by user");
    process.exit(130);
  });
  process.on("SIGTERM", async () => {
    process.stdout.write(showCursor);
    global.MOONWALL_TERMINATION_REASON = "terminated by system";
    const { MoonwallContext: MoonwallContext2 } = await Promise.resolve().then(
      () => (init_globalContext(), globalContext_exports)
    );
    await MoonwallContext2.destroy("terminated by system");
    process.exit(143);
  });
}
handleCursor();
configSetup(process.argv);
yargs(hideBin(process.argv))
  .wrap(null)
  .usage("Usage: $0")
  .version("2.0.0")
  .options({
    configFile: {
      type: "string",
      alias: "c",
      description: "path to MoonwallConfig file",
      default: "moonwall.config.json",
    },
  })
  .command(
    "init",
    "Run tests for a given Environment",
    (yargs2) =>
      yargs2.option("acceptAllDefaults", {
        type: "boolean",
        description: "Accept all defaults",
        alias: "A",
      }),
    async (argv) => {
      await generateConfig(argv);
    }
  )
  .command(
    "download <bin> [ver] [path]",
    "Download x86 artifact from GitHub",
    (yargs2) => {
      return yargs2
        .positional("bin", {
          describe: "Name of artifact to download\n[ moonbeam | polkadot | *-runtime ]",
          type: "string",
        })
        .positional("ver", {
          describe: "Artifact version to download",
          type: "string",
          default: "latest",
        })
        .positional("path", {
          describe: "Path where to save artifacts",
          type: "string",
          default: "./",
        })
        .option("overwrite", {
          describe: "If file exists, should it be overwritten?",
          type: "boolean",
          alias: "d",
          default: false,
        })
        .option("output-name", {
          describe: "Rename downloaded file to this name",
          alias: "o",
          type: "string",
        });
    },
    async (argv) => {
      await fetchArtifact(argv);
    }
  )
  .command(
    "test <envName> [GrepTest]",
    "Run tests for a given Environment",
    (yargs2) => {
      return yargs2
        .positional("envName", {
          describe: "Network environment to run tests against",
          array: true,
          string: true,
        })
        .positional("GrepTest", {
          type: "string",
          description: "Pattern to grep test ID/Description to run",
        })
        .option("subDirectory", {
          describe: "Additional sub-directory filter for test suites",
          alias: "d",
          type: "string",
        })
        .option("testShard", {
          describe: "Test Shard info for CI",
          alias: "ts",
          type: "string",
        })
        .option("update", {
          describe: "Update all snapshots",
          alias: "u",
          type: "boolean",
        })
        .option("vitestArgPassthrough", {
          describe: "Arguments to pass directly to Vitest (space-delimited)",
          alias: "vitest",
          type: "string",
        });
    },
    async (args) => {
      if (args.envName) {
        process.env.MOON_RUN_SCRIPTS = "true";
        if (
          !(await testCmd(args.envName.toString(), {
            testNamePattern: args.GrepTest,
            subDirectory: args.subDirectory,
            shard: args.testShard,
            update: args.update,
            vitestPassthroughArgs: args.vitestArgPassthrough?.split(" "),
          }))
        ) {
          process.exitCode = 1;
        }
      } else {
        console.log("\u274C No environment specified");
        console.log(`\u{1F449} Run 'pnpm moonwall --help' for more information`);
        process.exitCode = 1;
      }
    }
  )
  .command(
    "run <envName> [GrepTest]",
    "Start new network found in global config",
    (yargs2) => {
      return yargs2
        .positional("envName", {
          describe: "Network environment to start",
        })
        .positional("GrepTest", {
          type: "string",
          description: "Pattern to grep test ID/Description to run",
        })
        .option("subDirectory", {
          describe: "Additional sub-directory filter for test suites",
          alias: "d",
          type: "string",
        });
    },
    async (argv) => {
      process.env.MOON_RUN_SCRIPTS = "true";
      await runNetworkCmd(argv);
    }
  )
  .command(
    "derive <suitesRootDir>",
    "Derive test IDs based on positional order in the directory tree",
    (yargs2) => {
      return yargs2
        .positional("suitesRootDir", {
          describe: "Root directory of the suites",
          type: "string",
        })
        .option("prefixPhrase", {
          describe: "Root phrase to generate prefixes from (e.g. DEV)",
          alias: "p",
          type: "string",
        })
        .option("singlePrefix", {
          describe: "Use a single prefix for all suites, instead of deriving from folder names",
          alias: "l",
          default: false,
          type: "boolean",
        });
    },
    async ({ suitesRootDir, prefixPhrase, singlePrefix }) => {
      await deriveTestIds({
        rootDir: suitesRootDir,
        prefixPhrase,
        singlePrefix,
      });
    }
  )
  .demandCommand(1)
  .fail(async (msg) => {
    console.log(msg);
    await main();
  })
  .help("h")
  .alias("h", "help")
  .parseAsync()
  .then(async () => {
    if (process.env.MOON_EXIT) {
      process.exit();
    }
  });
