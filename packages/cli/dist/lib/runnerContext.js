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

// src/lib/runnerContext.ts
init_configReader();
import "@moonbeam-network/api-augment";
import Bottleneck from "bottleneck";
import { createLogger as createLogger6 } from "@moonwall/util";
import { afterAll, beforeAll, describe, it } from "vitest";

// src/lib/globalContext.ts
import "@moonbeam-network/api-augment";
import zombie from "@zombienet/orchestrator";
import { createLogger as createLogger5 } from "@moonwall/util";
import fs10 from "fs";
import net3 from "net";
import readline from "readline";
import { setTimeout as timer3 } from "timers/promises";
import path9 from "path";

// src/internal/commandParsers.ts
import chalk from "chalk";
import path2 from "path";
import net from "net";

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
function standardRepos() {
  const defaultRepos = [moonbeam_default, polkadot_default, tanssi_default];
  return [...defaultRepos];
}

// src/internal/commandParsers.ts
import invariant from "tiny-invariant";
function parseZombieCmd(launchSpec) {
  if (launchSpec) {
    return { cmd: launchSpec.configPath };
  }
  throw new Error(
    `No ZombieSpec found in config. 
 Are you sure your ${chalk.bgWhiteBright.blackBright(
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
      : fetchDefaultArgs(path2.basename(launchSpec.binPath), additionalRepos);
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
    console.log(chalk.cyan(`Command to run is: ${chalk.bold(this.cmd)}`));
    console.log(chalk.cyan(`Arguments are: ${chalk.bold(this.args.join(" "))}`));
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

// src/internal/foundations/zombieHelpers.ts
import chalk3 from "chalk";
import fs2 from "fs";
import invariant2 from "tiny-invariant";

// src/internal/fileCheckers.ts
import fs from "fs";
import { execSync } from "child_process";
import chalk2 from "chalk";
import os from "os";
import path3 from "path";
import { select } from "@inquirer/prompts";
async function checkExists(path12) {
  const binPath = path12.split(" ")[0];
  const fsResult = fs.existsSync(binPath);
  if (!fsResult) {
    throw new Error(
      `No binary file found at location: ${binPath} 
 Are you sure your ${chalk2.bgWhiteBright.blackBright(
   "moonwall.config.json"
 )} file has the correct "binPath" in launchSpec?`
    );
  }
  const binArch = await getBinaryArchitecture(binPath);
  const currentArch = os.arch();
  if (binArch !== currentArch && binArch !== "unknown") {
    throw new Error(
      `The binary architecture ${chalk2.bgWhiteBright.blackBright(
        binArch
      )} does not match this system's architecture ${chalk2.bgWhiteBright.blackBright(currentArch)}
Download or compile a new binary executable for ${chalk2.bgWhiteBright.blackBright(currentArch)} `
    );
  }
  return true;
}
function checkAccess(path12) {
  const binPath = path12.split(" ")[0];
  try {
    fs.accessSync(binPath, fs.constants.X_OK);
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
    fs.open(filePath, "r", (err, fd) => {
      if (err) {
        reject(err);
        return;
      }
      const buffer = Buffer.alloc(20);
      fs.read(fd, buffer, 0, 20, 0, (err2, bytesRead, buffer2) => {
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

// src/internal/foundations/zombieHelpers.ts
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
  const fsResult = fs2.existsSync(path12);
  if (!fsResult) {
    throw new Error(
      `No ZombieConfig file found at location: ${path12} 
 Are you sure your ${chalk3.bgWhiteBright.blackBright(
   "moonwall.config.json"
 )} file has the correct "configPath" in zombieSpec?`
    );
  }
  const buffer = fs2.readFileSync(path12, "utf-8");
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
import fs3 from "fs";
import path4 from "path";
import WebSocket from "ws";
init_configReader();
import { createLogger } from "@moonwall/util";
import { setTimeout as timer2 } from "timers/promises";
import util from "util";
import Docker from "dockerode";
import invariant3 from "tiny-invariant";
var execAsync = util.promisify(exec);
var logger = createLogger({ name: "localNode" });
var debug = logger.debug.bind(logger);
async function launchDockerContainer(imageName, args, name, dockerConfig) {
  const docker = new Docker();
  const port = args.find((a) => a.includes("port"))?.split("=")[1];
  debug(`\x1B[36mStarting Docker container ${imageName} on port ${port}...\x1B[0m`);
  const dirPath = path4.join(process.cwd(), "tmp", "node_logs");
  const logLocation = path4.join(dirPath, `${name}_docker_${Date.now()}.log`);
  const fsStream = fs3.createWriteStream(logLocation);
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
      fs3.appendFileSync(
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
      fs3.appendFileSync(
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
  debug(`\x1B[36mStarting ${name} node on port ${port}...\x1B[0m`);
  const dirPath = path4.join(process.cwd(), "tmp", "node_logs");
  const runningNode = spawn(cmd, args);
  const logLocation = path4
    .join(
      dirPath,
      `${path4.basename(cmd)}_node_${args.find((a) => a.includes("port"))?.split("=")[1]}_${runningNode.pid}.log`
    )
    .replaceAll("node_node_undefined", "chopsticks");
  process.env.MOON_LOG_LOCATION = logLocation;
  const fsStream = fs3.createWriteStream(logLocation);
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
        fs3.appendFileSync(
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
    fs3.appendFileSync(
      logLocation,
      `${errorMessage}
`
    );
    throw new Error(errorMessage);
  }
  if (runningNode.exitCode !== null) {
    const errorMessage = `Child process exited immediately with code ${runningNode.exitCode}`;
    console.error(errorMessage);
    fs3.appendFileSync(
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
      const { stdout } = await execAsync(`lsof -p ${pid} -n -P | grep LISTEN`);
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
import { createLogger as createLogger2 } from "@moonwall/util";
var logger2 = createLogger2({ name: "providers" });
var debug2 = logger2.debug.bind(logger2);
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
    debug2(`\u{1F7E2}  PolkadotJs provider ${this.providerConfig.name} details prepared`);
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
    debug2(`\u{1F7E2}  Web3 provider ${this.providerConfig.name} details prepared`);
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
    debug2(`\u{1F7E2}  Ethers provider ${this.providerConfig.name} details prepared`);
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
    debug2(`\u{1F7E2}  Viem omni provider ${this.providerConfig.name} details prepared`);
    return {
      name: this.providerConfig.name,
      type: this.providerConfig.type,
      connect: async () => {
        try {
          debug2(
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
    debug2(`\u{1F7E2}  Papi provider ${this.providerConfig.name} details prepared`);
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
    debug2(`\u{1F7E2}  Default provider ${this.providerConfig.name} details prepared`);
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
    debug2(`\u{1F50C} Connecting PolkadotJs provider: ${this.name}`);
    const api = await this.connect();
    debug2(`\u2705 PolkadotJs provider ${this.name} connected`);
    1;
    return {
      name: this.name,
      api,
      type: "polkadotJs",
      greet: async () => {
        debug2(
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
        debug2(
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
    debug2(`\u{1F504} Populating provider: ${name} of type: ${type}`);
    try {
      const providerInterface = await new _ProviderInterfaceFactory(name, type, connect).create();
      debug2(`\u2705 Successfully populated provider: ${name}`);
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
import { ChildProcess, exec as exec2, execSync as execSync4 } from "child_process";
import { promisify as promisify2 } from "util";

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
import fs4 from "fs";
import { Readable } from "stream";

// src/internal/cmdFunctions/fetchArtifact.ts
import fs5 from "fs/promises";
import path5 from "path";
import semver from "semver";
import chalk4 from "chalk";

// src/internal/processHelpers.ts
import child_process from "child_process";
import { promisify } from "util";
import { createLogger as createLogger3 } from "@moonwall/util";
var logger3 = createLogger3({ name: "actions:runner" });
var debug3 = logger3.debug.bind(logger3);
var execAsync2 = promisify(child_process.exec);
var withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Operation timed out")), ms)),
  ]);
};

// src/internal/cmdFunctions/fetchArtifact.ts
import { minimatch } from "minimatch";
init_configReader();
import { execSync as execSync2 } from "child_process";
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

// src/internal/cmdFunctions/initialisation.ts
import fs6 from "fs/promises";
import { input, number, confirm as confirm2 } from "@inquirer/prompts";

// src/internal/cmdFunctions/tempLogs.ts
import path6 from "path";
import fs7 from "fs";

// src/internal/deriveTestIds.ts
import chalk5 from "chalk";
import fs8 from "fs";
import { confirm as confirm3 } from "@inquirer/prompts";
import path7 from "path";

// src/internal/foundations/chopsticksHelpers.ts
import "@moonbeam-network/api-augment";
import chalk6 from "chalk";
import { setTimeout as setTimeout2 } from "timers/promises";
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
import { createLogger as createLogger4 } from "@moonwall/util";
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
var logger4 = createLogger4({ name: "DevTest" });
var debug4 = logger4.debug.bind(logger4);
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
import { execSync as execSync3 } from "child_process";
import fs9 from "fs";
import path8 from "path";
import Docker2 from "dockerode";
import { select as select3 } from "@inquirer/prompts";

// src/lib/globalContext.ts
import Docker3 from "dockerode";
import invariant4 from "tiny-invariant";
var logger5 = createLogger5({ name: "context" });
var debugSetup = logger5.debug.bind(logger5);
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
    const ipcLogPath = path9.join(network.tmpDir, "ipc-server.log");
    const ipcLogger = fs10.createWriteStream(ipcLogPath, { flags: "a" });
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
    if (fs10.existsSync(socketPath)) {
      fs10.unlinkSync(socketPath);
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
              const killResult = execSync4(`kill ${pid}`, { stdio: "ignore" });
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
        fs10.chmodSync(socketPath, 384);
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
        const readStream = fs10.createReadStream(logPath, { encoding: "utf8" });
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
        if (node instanceof Docker3.Container) {
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
      if (node instanceof Docker3.Container) {
        console.log("\u{1F6D1}  Stopping container");
        const logLocation = process.env.MOON_LOG_LOCATION;
        if (logLocation) {
          const timestamp = /* @__PURE__ */ new Date().toISOString();
          const message = `${timestamp} [moonwall] container stopped. reason: ${reason || "shutdown"}
`;
          try {
            fs10.appendFileSync(logLocation, message);
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
            fs10.appendFileSync(proc.logPath, message);
          } catch (err) {
            console.error(`Failed to append termination message to zombie log: ${err}`);
          }
        }
      }
      await ctx.zombieNetwork.stop();
      const processIds = zombieProcesses.map((process2) => process2.pid);
      try {
        execSync4(`kill ${processIds.join(" ")}`, {});
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
var contextCreator = async (options) => {
  const config = await importAsyncConfig();
  const ctx = await MoonwallContext.getContext(config, options);
  await runNetworkOnly();
  await ctx.connectEnvironment();
  return ctx;
};
var runNetworkOnly = async () => {
  const config = await importAsyncConfig();
  const ctx = await MoonwallContext.getContext(config);
  await ctx.startNetwork();
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

// src/lib/handlers/chopsticksHandler.ts
import {
  ALITH_PRIVATE_KEY as ALITH_PRIVATE_KEY2,
  BALTATHAR_PRIVATE_KEY,
  CHARLETH_PRIVATE_KEY,
  DOROTHY_PRIVATE_KEY,
  jumpRoundsChopsticks,
} from "@moonwall/util";
import { Keyring as Keyring2 } from "@polkadot/api";

// src/lib/upgradeProcedures.ts
import "@moonbeam-network/api-augment";
import { blake2AsHex as blake2AsHex2 } from "@polkadot/util-crypto";
import chalk9 from "chalk";
import { sha256 } from "ethers";
import fs12, { existsSync as existsSync2, readFileSync as readFileSync2 } from "fs";

// src/lib/binariesHelpers.ts
import "@moonbeam-network/api-augment";
import path10 from "path";
import fs11 from "fs";
import child_process2 from "child_process";
import { OVERRIDE_RUNTIME_PATH } from "@moonwall/util";
var BINARY_DIRECTORY = process.env.BINARY_DIRECTORY || "binaries";
var RUNTIME_DIRECTORY = process.env.RUNTIME_DIRECTORY || "runtimes";
var SPECS_DIRECTORY = process.env.SPECS_DIRECTORY || "specs";
async function getRuntimeWasm(runtimeName, runtimeTag, localPath) {
  const runtimePath = path10.join(RUNTIME_DIRECTORY, `${runtimeName}-${runtimeTag}.wasm`);
  if (!fs11.existsSync(RUNTIME_DIRECTORY)) {
    fs11.mkdirSync(RUNTIME_DIRECTORY, { recursive: true });
  }
  if (runtimeTag === "local") {
    const builtRuntimePath = localPath
      ? localPath
      : path10.join(
          OVERRIDE_RUNTIME_PATH || `../target/release/wbuild/${runtimeName}-runtime/`,
          `${runtimeName}_runtime.compact.compressed.wasm`
        );
    const code = fs11.readFileSync(builtRuntimePath);
    fs11.writeFileSync(runtimePath, `0x${code.toString("hex")}`);
  } else if (!fs11.existsSync(runtimePath)) {
    console.log(`     Missing ${runtimePath} locally, downloading it...`);
    child_process2.execSync(
      `mkdir -p ${path10.dirname(
        runtimePath
      )} && wget -q https://github.com/PureStake/moonbeam/releases/download/${runtimeTag}/${runtimeName}-${runtimeTag}.wasm -O ${runtimePath}.bin`
    );
    const code = fs11.readFileSync(`${runtimePath}.bin`);
    fs11.writeFileSync(runtimePath, `0x${code.toString("hex")}`);
    console.log(`${runtimePath} downloaded !`);
  }
  return runtimePath;
}

// src/lib/governanceProcedures.ts
import "@moonbeam-network/api-augment";
import {
  GLMR,
  alith as alith2,
  baltathar,
  charleth,
  dorothy,
  ethan,
  faith,
  filterAndApply as filterAndApply2,
  signAndSend,
} from "@moonwall/util";
import { blake2AsHex } from "@polkadot/util-crypto";
var COUNCIL_MEMBERS = [baltathar, charleth, dorothy];
var COUNCIL_THRESHOLD = Math.ceil((COUNCIL_MEMBERS.length * 2) / 3);
var TECHNICAL_COMMITTEE_MEMBERS = [alith2, baltathar];
var TECHNICAL_COMMITTEE_THRESHOLD = Math.ceil((TECHNICAL_COMMITTEE_MEMBERS.length * 2) / 3);
var OPEN_TECHNICAL_COMMITTEE_MEMBERS = [alith2, baltathar];
var OPEN_TECHNICAL_COMMITTEE_THRESHOLD = Math.ceil(
  (OPEN_TECHNICAL_COMMITTEE_MEMBERS.length * 2) / 3
);
var executeOpenTechCommitteeProposal = async (api, encodedHash) => {
  console.log("Executing OpenTechCommittee proposal");
  const queryPreimage = await api.query.preimage.requestStatusFor(encodedHash);
  if (queryPreimage.isNone) {
    throw new Error("Preimage not found");
  }
  process.stdout.write(`Sending proposal + vote for ${encodedHash}...`);
  const proposalLen = queryPreimage.unwrap().asUnrequested.len;
  const dispatchCallHex = api.tx.whitelist
    .dispatchWhitelistedCall(encodedHash, proposalLen, {
      refTime: 2e9,
      proofSize: 1e5,
    })
    .method.toHex();
  const dispatchCallPreimageHash = blake2AsHex(dispatchCallHex);
  await signAndSend(api.tx.preimage.notePreimage(dispatchCallHex), charleth);
  const queryDispatchPreimage = await api.query.preimage.requestStatusFor(dispatchCallPreimageHash);
  if (queryDispatchPreimage.isNone) {
    throw new Error("Dispatch preimage not found");
  }
  const dispatchCallPreimageLen = queryDispatchPreimage.unwrap().asUnrequested.len;
  await signAndSend(
    api.tx.referenda.submit(
      {
        Origins: { whitelistedcaller: "WhitelistedCaller" },
      },
      {
        Lookup: {
          hash: dispatchCallPreimageHash,
          len: dispatchCallPreimageLen,
        },
      },
      { After: { After: 0 } }
    ),
    charleth
  );
  const proposalId = (await api.query.referenda.referendumCount()).toNumber() - 1;
  if (proposalId < 0) {
    throw new Error("Proposal id not found");
  }
  await api.tx.referenda.placeDecisionDeposit(proposalId).signAndSend(alith2);
  process.stdout.write(`Sending proposal to openTechCommittee to whitelist ${encodedHash}...`);
  await signAndSend(
    api.tx.openTechCommitteeCollective.propose(2, api.tx.whitelist.whitelistCall(encodedHash), 100)
  );
  const openTechProposal = (await api.query.openTechCommitteeCollective.proposals()).at(-1);
  if (!openTechProposal || openTechProposal?.isEmpty) {
    throw new Error("OpenTechProposal not found");
  }
  const index = (await api.query.openTechCommitteeCollective.proposalCount()).toNumber() - 1;
  if (index < 0) {
    throw new Error("OpenTechProposal index not found");
  }
  process.stdout.write("\u2705\n");
  const baltaNonce = (await api.rpc.system.accountNextIndex(baltathar.address)).toNumber();
  process.stdout.write("Voting on openTechCommittee proposal...");
  await Promise.all([
    signAndSend(api.tx.openTechCommitteeCollective.vote(openTechProposal, index, true)),
    signAndSend(
      api.tx.openTechCommitteeCollective.vote(openTechProposal, index, true),
      baltathar,
      baltaNonce
    ),
    signAndSend(
      api.tx.openTechCommitteeCollective.close(
        openTechProposal,
        index,
        {
          refTime: 2e9,
          proofSize: 1e5,
        },
        100
      ),
      baltathar,
      baltaNonce + 1
    ),
  ]);
  process.stdout.write("\u2705\n");
  process.stdout.write("Voting on main referendum proposal...");
  const bal = (await api.query.system.account(dorothy.address)).data.free.toBigInt();
  if (bal <= GLMR) {
    throw new Error("Dorothy has no funds to vote with");
  }
  await signAndSend(
    api.tx.convictionVoting.vote(proposalId, {
      Standard: {
        vote: { aye: true, conviction: "Locked6x" },
        balance: bal - GLMR,
      },
    }),
    dorothy
  );
  process.stdout.write("\u2705\n");
  process.stdout.write(`Waiting for referendum [${proposalId}] to be no longer ongoing...`);
  let referendaInfo;
  for (;;) {
    try {
      referendaInfo = (await api.query.referenda.referendumInfoFor(proposalId)).unwrap();
      if (!referendaInfo.isOngoing) {
        process.stdout.write("\u2705\n");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    } catch (e) {
      console.error(e);
      throw new Error(`Error querying referendum info for proposalId: ${proposalId}`);
    }
  }
  process.stdout.write(`${referendaInfo.isApproved ? "\u2705" : "\u274C"} 
`);
  if (!referendaInfo.isApproved) {
    throw new Error("Finished Referendum was not approved");
  }
};
var executeProposalWithCouncil = async (api, encodedHash) => {
  let nonce = (await api.rpc.system.accountNextIndex(alith2.address)).toNumber();
  const referendumNextIndex = (await api.query.democracy.referendumCount()).toNumber();
  const callData =
    api.consts.system.version.specVersion.toNumber() >= 2e3 ? { Legacy: encodedHash } : encodedHash;
  const external = api.tx.democracy.externalProposeMajority(callData);
  const fastTrack = api.tx.democracy.fastTrack(encodedHash, 1, 0);
  const voteAmount = 1n * 10n ** BigInt(api.registry.chainDecimals[0]);
  process.stdout.write(`Sending motion + fast-track + vote for ${encodedHash}...`);
  await Promise.all([
    api.tx.councilCollective
      .propose(1, external, external.length)
      .signAndSend(alith2, { nonce: nonce++ }),
    api.tx.techCommitteeCollective
      .propose(1, fastTrack, fastTrack.length)
      .signAndSend(alith2, { nonce: nonce++ }),
    api.tx.democracy
      .vote(referendumNextIndex, {
        Standard: {
          balance: voteAmount,
          vote: { aye: true, conviction: 1 },
        },
      })
      .signAndSend(alith2, { nonce: nonce++ }),
  ]);
  process.stdout.write("\u2705\n");
  process.stdout.write(`Waiting for referendum [${referendumNextIndex}] to be executed...`);
  let referenda;
  while (!referenda) {
    try {
      referenda = (
        (await api.query.democracy.referendumInfoOf.entries()).find(
          (ref) =>
            ref[1].unwrap().isFinished &&
            api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber() ===
              referendumNextIndex
        )?.[1]
      ).unwrap();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
  }
  process.stdout.write(`${referenda.asFinished.approved ? "\u2705" : "\u274C"} 
`);
  if (!referenda.asFinished.approved) {
    throw new Error("Finished Referendum was not approved");
  }
};
var cancelReferendaWithCouncil = async (api, refIndex) => {
  const proposal = api.tx.democracy.cancelReferendum(refIndex);
  const encodedProposal = proposal.method.toHex();
  const encodedHash = blake2AsHex(encodedProposal);
  let nonce = (await api.rpc.system.accountNextIndex(alith2.address)).toNumber();
  await api.tx.democracy.notePreimage(encodedProposal).signAndSend(alith2, { nonce: nonce++ });
  await executeProposalWithCouncil(api, encodedHash);
};

// src/lib/upgradeProcedures.ts
async function upgradeRuntimeChopsticks(context, path12, providerName) {
  if (!existsSync2(path12)) {
    throw new Error(`Runtime wasm not found at path: ${path12}`);
  }
  const rtWasm = readFileSync2(path12);
  const rtHex = `0x${rtWasm.toString("hex")}`;
  const rtHash = blake2AsHex2(rtHex);
  const api = context.polkadotJs(providerName);
  const signer = context.keyring.alice;
  if ("authorizedUpgrade" in api.query.system) {
    await context.setStorage({
      providerName,
      module: "system",
      method: "authorizedUpgrade",
      methodParams: `${rtHash}01`,
      // 01 is for the RT ver check = true
    });
    await context.createBlock({ providerName });
    await api.tx.system.applyAuthorizedUpgrade(rtHex).signAndSend(signer);
  } else {
    await context.setStorage({
      providerName,
      module: "parachainSystem",
      method: "authorizedUpgrade",
      methodParams: `${rtHash}01`,
      // 01 is for the RT ver check = true
    });
    await context.createBlock({ providerName });
    await api.tx.parachainSystem.enactAuthorizedUpgrade(rtHex).signAndSend(signer);
  }
  await context.createBlock({ providerName, count: 3 });
}
async function upgradeRuntime(api, preferences) {
  const options = {
    waitMigration: true,
    upgradeMethod: "Sudo",
    ...preferences,
  };
  return new Promise(async (resolve, reject) => {
    const log = (text) => {
      if (options.logger) {
        if (typeof options.logger === "function") {
          return options.logger(text);
        }
        if (typeof options.logger.info === "function") {
          return options.logger.info(text);
        }
      }
      return;
    };
    if (!options.runtimeName) {
      throw new Error("'runtimeName' is required to upgrade runtime");
    }
    if (!options.runtimeTag) {
      throw new Error("'runtimeTag' is required to upgrade runtime");
    }
    if (!options.from) {
      throw new Error("'from' is required to upgrade runtime");
    }
    try {
      const code = fs12
        .readFileSync(
          await getRuntimeWasm(options.runtimeName, options.runtimeTag, options.localPath)
        )
        .toString();
      log("Checking if upgrade is needed...");
      const existingCode = await api.rpc.state.getStorage(":code");
      if (!existingCode) {
        throw "No existing runtime code found";
      }
      if (existingCode.toString() === code) {
        reject(
          `Runtime upgrade with same code: ${existingCode.toString().slice(0, 20)} vs ${code.toString().slice(0, 20)}`
        );
      }
      let nonce = (await api.rpc.system.accountNextIndex(options.from.address)).toNumber();
      switch (options.upgradeMethod) {
        case "Sudo": {
          log(
            `Sending sudo.setCode (${sha256(Buffer.from(code))} [~${Math.floor(
              code.length / 1024
            )} kb])...`
          );
          const isWeightV1 = !api.registry.createType("Weight").proofSize;
          await api.tx.sudo
            .sudoUncheckedWeight(
              await api.tx.system.setCodeWithoutChecks(code),
              isWeightV1
                ? "1"
                : {
                    proofSize: 1,
                    refTime: 1,
                  }
            )
            .signAndSend(options.from, { nonce: nonce++ });
          log("\u2705");
          break;
        }
        case "Governance": {
          log("Using governance...");
          const proposal =
            api.consts.system.version.specVersion.toNumber() >= 2400
              ? api.tx.parachainSystem.authorizeUpgrade(blake2AsHex2(code), true)
              : api.tx.parachainSystem.authorizeUpgrade(blake2AsHex2(code));
          const encodedProposal = proposal.method.toHex();
          const encodedHash = blake2AsHex2(encodedProposal);
          log("Checking if preimage already exists...");
          const preImageExists =
            api.query.preimage && (await api.query.preimage.statusFor(encodedHash));
          const democracyPreImageExists =
            !api.query.preimage && (await api.query.democracy.preimages(encodedHash));
          if (api.query.preimage && preImageExists.isSome && preImageExists.unwrap().isRequested) {
            log(`Preimage ${encodedHash} already exists !
`);
          } else if (!api.query.preimage && democracyPreImageExists) {
            log(`Preimage ${encodedHash} already exists !
`);
          } else {
            log(
              `Registering preimage (${sha256(Buffer.from(code))} [~${Math.floor(
                code.length / 1024
              )} kb])...`
            );
            if (api.query.preimage) {
              await api.tx.preimage
                .notePreimage(encodedProposal)
                .signAndSend(options.from, { nonce: nonce++ });
            } else {
              await api.tx.democracy
                .notePreimage(encodedProposal)
                .signAndSend(options.from, { nonce: nonce++ });
            }
            log("Complete \u2705");
          }
          const referendum = await api.query.democracy.referendumInfoOf.entries();
          const referendaIndex = api.query.preimage
            ? referendum
                .filter(
                  (ref) =>
                    ref[1].unwrap().isOngoing &&
                    ref[1].unwrap().asOngoing.proposal.isLookup &&
                    ref[1].unwrap().asOngoing.proposal.asLookup.hash.toHex() === encodedHash
                )
                .map((ref) =>
                  api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber()
                )?.[0]
            : referendum
                .filter(
                  (ref) =>
                    ref[1].unwrap().isOngoing &&
                    ref[1].unwrap().asOngoing.proposalHash.toHex() === encodedHash
                )
                .map((ref) =>
                  api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber()
                )?.[0];
          if (referendaIndex !== null && referendaIndex !== void 0) {
            log("Vote for upgrade already in referendum, cancelling it.");
            await cancelReferendaWithCouncil(api, referendaIndex);
          }
          await executeProposalWithCouncil(api, encodedHash);
          nonce = (await api.rpc.system.accountNextIndex(options.from.address)).toNumber();
          log("Enacting authorized upgrade...");
          await api.tx.parachainSystem
            .enactAuthorizedUpgrade(code)
            .signAndSend(options.from, { nonce: nonce++ });
          log("Complete \u2705");
          break;
        }
        case "WhiteListedCaller": {
          log("Using WhiteListed Caller...");
          const proposal = api.tx.parachainSystem.authorizeUpgrade(blake2AsHex2(code), true);
          const encodedProposal = proposal.method.toHex();
          const encodedHash = blake2AsHex2(encodedProposal);
          log("Checking if preimage already exists...");
          const preImageExists =
            api.query.preimage && (await api.query.preimage.statusFor(encodedHash));
          if (preImageExists.isSome && preImageExists.unwrap().isRequested) {
            log(`Preimage ${encodedHash} already exists !
`);
          } else {
            log(
              `Registering preimage (${sha256(Buffer.from(code))} [~${Math.floor(
                code.length / 1024
              )} kb])...`
            );
            await api.tx.preimage
              .notePreimage(encodedProposal)
              .signAndSend(options.from, { nonce: nonce++ });
            log("Complete \u2705");
          }
          const referendum = await api.query.referenda.referendumInfoFor.entries();
          const referendaIndex = referendum
            .filter(
              (ref) =>
                ref[1].unwrap().isOngoing &&
                ref[1].unwrap().asOngoing.proposal.isLookup &&
                ref[1].unwrap().asOngoing.proposal.asLookup.hash.toHex() === encodedHash
            )
            .map((ref) => api.registry.createType("u32", ref[0].toU8a().slice(-4)).toNumber())?.[0];
          await executeOpenTechCommitteeProposal(api, encodedHash);
          break;
        }
      }
      log(`Waiting to apply new runtime (${chalk9.red("~4min")})...`);
      let isInitialVersion = true;
      const unsub = await api.rpc.state.subscribeStorage([":code"], async (newCode) => {
        if (!isInitialVersion) {
          const blockNumber = (await api.rpc.chain.getHeader()).number.toNumber();
          log(
            `Complete \u2705 [New Code: ${newCode.toString().slice(0, 5)}...${newCode.toString().slice(-4)} , Old Code:${existingCode.toString().slice(0, 5)}...${existingCode.toString().slice(-4)}] [#${blockNumber}]`
          );
          unsub();
          if (newCode.toString() !== code) {
            reject(
              `Unexpected new code: ${newCode.toString().slice(0, 20)} vs ${code.toString().slice(0, 20)}`
            );
          }
          if (options.waitMigration) {
            const blockToWait = (await api.rpc.chain.getHeader()).number.toNumber() + 1;
            await new Promise(async (resolve2) => {
              const subBlocks = await api.rpc.chain.subscribeNewHeads(async (header) => {
                if (header.number.toNumber() === blockToWait) {
                  subBlocks();
                  resolve2(blockToWait);
                }
              });
            });
          }
          resolve(blockNumber);
        }
        isInitialVersion = false;
      });
    } catch (e) {
      console.error(e);
      console.error("Failed to setCode");
      reject(e);
    }
  });
}

// src/lib/handlers/chopsticksHandler.ts
var chopsticksHandler = ({ testCases, context, testCase, logger: logger6 }) => {
  const accountTypeLookup = () => {
    const metadata = ctx.polkadotJs().runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === "System"
    );
    const systemAccountStorageType = metadata.pallets[systemPalletIndex].storage
      .unwrap()
      .items.find((storage) => storage.name.toString() === "Account")?.type;
    if (!systemAccountStorageType) {
      throw new Error("System.Account storage not found");
    }
    return metadata.lookup.getTypeDef(systemAccountStorageType.asMap.key).type;
  };
  const newKeyring = () => {
    const isEth = accountTypeLookup() === "AccountId20";
    const keyring = new Keyring2({
      type: isEth ? "ethereum" : "sr25519",
    });
    return {
      alice: keyring.addFromUri(isEth ? ALITH_PRIVATE_KEY2 : "//Alice", {
        name: "Alice default",
      }),
      bob: keyring.addFromUri(isEth ? BALTATHAR_PRIVATE_KEY : "//Bob", {
        name: "Bob default",
      }),
      charlie: keyring.addFromUri(isEth ? CHARLETH_PRIVATE_KEY : "//Charlie", {
        name: "Charlie default",
      }),
      dave: keyring.addFromUri(isEth ? DOROTHY_PRIVATE_KEY : "//Dave", {
        name: "Dave default",
      }),
    };
  };
  const ctx = {
    ...context,
    get isEthereumChain() {
      return accountTypeLookup() === "AccountId20";
    },
    get isSubstrateChain() {
      return accountTypeLookup() === "AccountId32";
    },
    get pjsApi() {
      return context.polkadotJs();
    },
    get keyring() {
      return newKeyring();
    },
    createBlock: async (options = {}) => await createChopsticksBlock(context, options),
    setStorage: async (params) => await sendSetStorageRequest(params),
    upgradeRuntime: async (providerName) => {
      const path12 = (await MoonwallContext.getContext()).rtUpgradePath;
      if (!path12) {
        throw new Error("No runtime upgrade path defined in config");
      }
      await upgradeRuntimeChopsticks(ctx, path12, providerName);
    },
    jumpRounds: async (options) => {
      const api = context.polkadotJs(options.providerName);
      if (!containsPallet(api, "ParachainStaking")) {
        throw new Error("ParachainStaking pallet is not enabled");
      }
      const wsUrl = await getWsUrlFromConfig(options.providerName);
      const url = new URL(wsUrl);
      const port = Number.parseInt(url.port);
      await jumpRoundsChopsticks(api, port, options.rounds);
    },
  };
  testCases({
    context: ctx,
    it: testCase,
    log: logger6.info.bind(logger6),
    logger: logger6,
  });
};
var containsPallet = (polkadotJsApi, palletName) => {
  const metadata = polkadotJsApi.runtimeMetadata.asLatest;
  const systemPalletIndex = metadata.pallets.findIndex(
    (pallet) => pallet.name.toString() === palletName
  );
  return systemPalletIndex !== -1;
};

// src/lib/handlers/devHandler.ts
import {
  ALITH_PRIVATE_KEY as ALITH_PRIVATE_KEY4,
  BALTATHAR_PRIVATE_KEY as BALTATHAR_PRIVATE_KEY2,
  CHARLETH_PRIVATE_KEY as CHARLETH_PRIVATE_KEY2,
  DOROTHY_PRIVATE_KEY as DOROTHY_PRIVATE_KEY2,
  alith as alith3,
  createEthersTransaction as createEthersTransaction2,
  createViemTransaction as createViemTransaction2,
  jumpBlocksDev,
  jumpRoundsDev,
} from "@moonwall/util";
import { Keyring as Keyring3 } from "@polkadot/api";
init_configReader();

// src/lib/contractFunctions.ts
init_configReader();
import {
  ALITH_PRIVATE_KEY as ALITH_PRIVATE_KEY3,
  PRECOMPILES,
  createEthersTransaction,
  createViemTransaction,
  deployViemContract,
} from "@moonwall/util";
import chalk10 from "chalk";
import { Interface, Wallet as Wallet2 } from "ethers";
import fs13, { readFileSync as readFileSync3 } from "fs";
import path11 from "path";
import { decodeFunctionResult, encodeFunctionData, toHex } from "viem";
import { privateKeyToAccount as privateKeyToAccount2 } from "viem/accounts";
function getCompiledPath(contractName) {
  const config = importJsonConfig();
  const contractsDir = config.environments.find(
    (env) => env.name === process.env.MOON_TEST_ENV
  )?.contracts;
  if (!contractsDir) {
    throw new Error(
      `Contracts directory not found for environment config ${process.env.MOON_TEST_ENV}
Please specify path to Foundry directory at:  ${chalk10.bgWhiteBright.blackBright(
        "moonwall.config.json > environments > contracts"
      )}`
    );
  }
  const compiledJsonPath = recursiveSearch(contractsDir, `${contractName}.json`);
  const solidityFilePath = recursiveSearch(contractsDir, `${contractName}.sol`);
  if (!compiledJsonPath && !solidityFilePath) {
    throw new Error(
      `Neither solidity contract ${contractName}.sol nor its compiled json exists in ${contractsDir}`
    );
  }
  if (!compiledJsonPath) {
    throw new Error(
      `Compiled contract ${contractName}.json doesn't exist
Please ${chalk10.bgWhiteBright.blackBright("recompile contract")} ${contractName}.sol`
    );
  }
  return compiledJsonPath;
}
function fetchCompiledContract(contractName) {
  const compiledPath = getCompiledPath(contractName);
  const json = readFileSync3(compiledPath, "utf8");
  const parsed = JSON.parse(json);
  return {
    abi: parsed.contract.abi,
    bytecode: parsed.byteCode,
    methods: parsed.contract.evm.methodIdentifiers,
    deployedBytecode: `0x${parsed.contract.evm.deployedBytecode.object}`,
  };
}
function recursiveSearch(dir, filename) {
  const files = fs13.readdirSync(dir);
  for (const file of files) {
    const filepath = path11.join(dir, file);
    const stats = fs13.statSync(filepath);
    if (stats.isDirectory()) {
      const searchResult = recursiveSearch(filepath, filename);
      if (searchResult) {
        return searchResult;
      }
    } else if (stats.isFile() && file === filename) {
      return filepath;
    }
  }
  return null;
}
async function interactWithPrecompileContract(context, callOptions) {
  const { precompileName, ...rest } = callOptions;
  const precompileInfo = PRECOMPILES[precompileName];
  if (!precompileInfo) {
    throw new Error(`No precompile found with the name: ${precompileName}`);
  }
  const [contractAddress, contractName] = Array.isArray(precompileInfo)
    ? precompileInfo
    : [precompileInfo, precompileName];
  return await interactWithContract(context, {
    ...rest,
    contractName,
    contractAddress,
  });
}
async function interactWithContract(context, callOptions) {
  const {
    contractName,
    contractAddress,
    functionName,
    args = [],
    web3Library = "viem",
    gas = "estimate",
    value = 0n,
    privateKey = ALITH_PRIVATE_KEY3,
    rawTxOnly = false,
    call = false,
  } = callOptions;
  const { abi } = fetchCompiledContract(contractName);
  const data = encodeFunctionData({
    abi,
    functionName,
    args,
  });
  const account = privateKeyToAccount2(privateKey);
  const gasParam =
    gas === "estimate"
      ? await context.viem().estimateGas({
          account: account.address,
          to: contractAddress,
          value: 0n,
          data,
        })
      : gas > 0n
        ? gas
        : 200000n;
  if (!call && rawTxOnly) {
    return web3Library === "viem"
      ? createViemTransaction(context, {
          to: contractAddress,
          data,
          gas: gasParam,
          privateKey,
          value,
        })
      : createEthersTransaction(context, {
          to: contractAddress,
          data,
          gas: gasParam,
          value: toHex(value),
          privateKey,
        });
  }
  if (call) {
    if (web3Library === "viem") {
      const result2 = await context.viem().call({
        account: account.address,
        to: contractAddress,
        value: 0n,
        data,
        gas: gasParam,
      });
      if (!result2.data) {
        throw new Error("No data field returned from call");
      }
      return decodeFunctionResult({ abi, functionName, data: result2.data });
    }
    const result = await context.ethers().call({
      from: account.address,
      to: contractAddress,
      value: toHex(value),
      data,
      gasLimit: toHex(gasParam),
    });
    return new Interface(abi).decodeFunctionResult(functionName, result);
  }
  if (!rawTxOnly) {
    if (web3Library === "viem") {
      const hash2 = await context.viem().sendTransaction({
        account,
        to: contractAddress,
        value,
        data,
        gas: gasParam,
      });
      return hash2;
    }
    const signer = new Wallet2(privateKey, context.ethers().provider);
    const { hash } = await signer.sendTransaction({
      from: account.address,
      to: contractAddress,
      value: toHex(value),
      data,
      gasLimit: toHex(gasParam),
    });
    return hash;
  }
  throw new Error("This should never happen, if it does there's a logic error in the code");
}
async function deployCreateCompiledContract(context, contractName, options) {
  const { abi, bytecode, methods } = fetchCompiledContract(contractName);
  const { privateKey = ALITH_PRIVATE_KEY3, args = [], ...rest } = options || {};
  const blob = {
    ...rest,
    privateKey,
    args,
  };
  const { contractAddress, logs, status, hash } = await deployViemContract(
    context,
    abi,
    bytecode,
    blob
  );
  return {
    contractAddress,
    logs,
    hash,
    status,
    abi,
    bytecode,
    methods,
  };
}

// src/lib/handlers/devHandler.ts
var devHandler = ({ testCases, context, testCase, logger: logger6 }) => {
  const env = getEnvironmentFromConfig();
  const ethCompatible = isEthereumDevConfig();
  const accountTypeLookup = () => {
    const metadata = ctx.polkadotJs().runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === "System"
    );
    const systemAccountStorage = metadata.pallets[systemPalletIndex].storage
      .unwrap()
      .items.find((storage) => storage.name.toString() === "Account");
    if (!systemAccountStorage) {
      throw new Error("Account storage not found");
    }
    const systemAccountStorageType = systemAccountStorage.type;
    return metadata.lookup.getTypeDef(systemAccountStorageType.asMap.key).type;
  };
  const newKeyring = () => {
    const isEth = accountTypeLookup() === "AccountId20";
    const keyring = new Keyring3({
      type: isEth ? "ethereum" : "sr25519",
    });
    return {
      alice: keyring.addFromUri(isEth ? ALITH_PRIVATE_KEY4 : "//Alice", {
        name: "Alice default",
      }),
      bob: keyring.addFromUri(isEth ? BALTATHAR_PRIVATE_KEY2 : "//Bob", {
        name: "Bob default",
      }),
      charlie: keyring.addFromUri(isEth ? CHARLETH_PRIVATE_KEY2 : "//Charlie", {
        name: "Charlie default",
      }),
      dave: keyring.addFromUri(isEth ? DOROTHY_PRIVATE_KEY2 : "//Dave", {
        name: "Dave default",
      }),
    };
  };
  const containsPallet2 = (palletName) => {
    const metadata = context.polkadotJs().runtimeMetadata.asLatest;
    const systemPalletIndex = metadata.pallets.findIndex(
      (pallet) => pallet.name.toString() === palletName
    );
    return systemPalletIndex !== -1;
  };
  const ctx = {
    ...context,
    get isEthereumChain() {
      return accountTypeLookup() === "AccountId20";
    },
    get isSubstrateChain() {
      return accountTypeLookup() === "AccountId32";
    },
    get pjsApi() {
      return context.polkadotJs();
    },
    get isParachainStaking() {
      return containsPallet2("ParachainStaking");
    },
    get keyring() {
      return newKeyring();
    },
    createBlock: async (transactions, options) => {
      const defaults = {
        signer: env.defaultSigner || alith3,
        allowFailures: env.defaultAllowFailures === void 0 ? true : env.defaultAllowFailures,
        finalize: env.defaultFinalization === void 0 ? true : env.defaultFinalization,
      };
      return await createDevBlock(context, { ...defaults, ...options }, transactions);
    },
    createTxn: !ethCompatible
      ? void 0
      : (options) => {
          const { libraryType = "viem", ...txnOptions } = options;
          return libraryType === "viem"
            ? createViemTransaction2(ctx, txnOptions)
            : createEthersTransaction2(ctx, txnOptions);
        },
    readPrecompile: !ethCompatible
      ? void 0
      : async (options) => {
          const response = await interactWithPrecompileContract(ctx, {
            call: true,
            ...options,
          });
          return response;
        },
    writePrecompile: !ethCompatible
      ? void 0
      : async (options) => {
          const response = await interactWithPrecompileContract(ctx, {
            call: false,
            ...options,
          });
          return response;
        },
    readContract: !ethCompatible
      ? void 0
      : async (options) => {
          const response = await interactWithContract(ctx, {
            call: true,
            ...options,
          });
          return response;
        },
    writeContract: !ethCompatible
      ? void 0
      : async (options) => {
          const response = await interactWithContract(ctx, {
            call: false,
            ...options,
          });
          return response;
        },
    deployContract: !ethCompatible
      ? void 0
      : async (contractName, options) => {
          return await deployCreateCompiledContract(ctx, contractName, options);
        },
    jumpBlocks: async (blocks) => {
      await jumpBlocksDev(context.polkadotJs(), blocks);
    },
    jumpRounds: async (rounds) => {
      if (!ctx.isParachainStaking) {
        throw new Error("ParachainStaking pallet is not enabled");
      }
      await jumpRoundsDev(context.polkadotJs(), rounds);
    },
  };
  testCases({
    context: ctx,
    it: testCase,
    log: logger6.info.bind(logger6),
    logger: logger6,
  });
};

// src/lib/handlers/readOnlyHandler.ts
var readOnlyHandler = ({ testCases, context, testCase, logger: logger6 }) => {
  testCases({
    context: {
      ...context,
      waitBlock: async (blocksToWaitFor = 1, chainName, mode = "quantity") => {
        const ctx = await MoonwallContext.getContext();
        const provider = chainName
          ? ctx.providers.find((prov) => prov.name === chainName && prov.type === "polkadotJs")
          : ctx.providers.find((prov) => prov.type === "polkadotJs");
        if (!provider) {
          throw new Error("No PolkadotJs api found in provider config");
        }
        const api = provider.api;
        const currentBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
        for (;;) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const newBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
          if (mode === "quantity" && newBlockNumber >= currentBlockNumber + blocksToWaitFor) {
            break;
          }
          if (mode === "height" && newBlockNumber >= blocksToWaitFor) {
            break;
          }
        }
      },
    },
    it: testCase,
    log: logger6.info.bind(logger6),
    logger: logger6,
  });
};

// src/lib/handlers/zombieHandler.ts
import { alith as alith4 } from "@moonwall/util";
var zombieHandler = ({ testCases, context, testCase, logger: logger6 }) => {
  testCases({
    context: {
      ...context,
      waitBlock: async (blocksToWaitFor = 1, chain = "parachain", mode = "quantity") => {
        const ctx = await MoonwallContext.getContext();
        const provider = ctx.providers.find((prov) => prov.name === chain);
        if (!provider) {
          throw new Error(`Provider '${chain}' not found`);
        }
        const api = provider.api;
        const currentBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
        for (;;) {
          await new Promise((resolve) => setTimeout(resolve, 1e3));
          const newBlockNumber = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
          if (mode === "quantity" && newBlockNumber >= currentBlockNumber + blocksToWaitFor) {
            break;
          }
          if (mode === "height" && newBlockNumber >= blocksToWaitFor) {
            break;
          }
        }
      },
      upgradeRuntime: async (options = {}) => {
        const ctx = await MoonwallContext.getContext();
        if (!ctx.rtUpgradePath) {
          throw new Error("Runtime upgrade path not defined in moonwall config");
        }
        const provider = ctx.providers.find((prov) => prov.name === "parachain");
        if (!provider) {
          throw new Error(`Provider 'parachain' not found`);
        }
        const api = provider.api;
        const params = {
          runtimeName: options.runtimeName || "moonbase",
          runtimeTag: options.runtimeTag || "local",
          localPath: options.localPath || ctx.rtUpgradePath,
          upgradeMethod: options.upgradeMethod || "Sudo",
          waitMigration: options.waitMigration || true,
          from: options.from || alith4,
        };
        if (options.logger) {
          params.logger = options.logger;
        }
        await upgradeRuntime(api, params);
      },
      restartNode: async (nodeName) => {
        await sendIpcMessage({
          text: `Restarting node ${nodeName}`,
          cmd: "restart",
          nodeName,
        });
      },
      pauseNode: async (nodeName) => {
        await sendIpcMessage({
          text: `Pausing node ${nodeName}`,
          cmd: "pause",
          nodeName,
        });
      },
      resumeNode: async (nodeName) => {
        await sendIpcMessage({
          text: `Resuming node ${nodeName}`,
          cmd: "resume",
          nodeName,
        });
      },
      killNode: async (nodeName) => {
        await sendIpcMessage({
          text: `Killing node ${nodeName}`,
          cmd: "kill",
          nodeName,
        });
      },
      isUp: async (nodeName) => {
        const response = await sendIpcMessage({
          text: `Checking if node ${nodeName} is up`,
          cmd: "isup",
          nodeName,
        });
        return response.status === "success";
      },
    },
    it: testCase,
    log: logger6.info.bind(logger6),
    logger: logger6,
  });
};

// src/lib/runnerContext.ts
var RT_VERSION = Number(process.env.MOON_RTVERSION);
var RT_NAME = process.env.MOON_RTNAME;
var limiter = void 0;
function describeSuite({
  id: suiteId,
  title,
  testCases,
  foundationMethods,
  minRtVersion,
  chainType,
  notChainType,
  options,
}) {
  if (
    (minRtVersion && minRtVersion > RT_VERSION) ||
    (chainType && chainType !== RT_NAME) ||
    (notChainType && notChainType === RT_NAME)
  ) {
    describe.skip(`\u{1F5C3}\uFE0F  ${suiteId} ${title}`);
    return;
  }
  let ctx = null;
  const logger6 = createLogger6({ name: suiteId });
  beforeAll(async () => {
    const env = getEnvironmentFromConfig();
    if (env.foundation.type === "dev") {
      ctx = await contextCreator(options);
    }
    ctx = await contextCreator();
    if (env.foundation.type === "read_only") {
      const settings = loadParams(env.foundation.launchSpec);
      limiter = new Bottleneck(settings);
    }
  });
  afterAll(async () => {
    const reason = global.MOONWALL_TERMINATION_REASON || "tests finished";
    await MoonwallContext.destroy(reason);
    ctx = null;
  });
  const testCase = (params) => {
    if (params.modifier) {
      it[params.modifier](
        `\u{1F4C1}  ${suiteId.concat(params.id)} ${params.title}`,
        params.test,
        params.timeout
      );
      return;
    }
    if (
      (params.minRtVersion && params.minRtVersion > RT_VERSION) ||
      (params.chainType && params.chainType !== RT_NAME) ||
      (params.notChainType && params.notChainType === RT_NAME)
    ) {
      it.skip(
        `\u{1F4C1}  ${suiteId.concat(params.id)} ${params.title}`,
        params.test,
        params.timeout
      );
      return;
    }
    it(`\u{1F4C1}  ${suiteId.concat(params.id)} ${params.title}`, params.test, params.timeout);
  };
  describe(`\u{1F5C3}\uFE0F  ${suiteId} ${title}`, () => {
    const getApi = (apiType, apiName) => {
      if (!ctx) {
        throw new Error("Context not initialized");
      }
      const provider = ctx.providers.find((prov) => {
        if (apiType && apiName) {
          return prov.type === apiType && prov.name === apiName;
        }
        if (apiType && !apiName) {
          return prov.type === apiType;
        }
        if (!apiType && apiName) {
          return prov.name === apiName;
        }
        return false;
      });
      if (!provider) {
        throw new Error(
          `API of type ${apiType} ${apiName ? `and name ${apiName}` : ""} could not be found`
        );
      }
      return !limiter ? provider.api : scheduleWithBottleneck(provider.api);
    };
    const context = {
      api: (type, name) => getApi(type, name),
      viem: (apiName) => getApi("viem", apiName),
      polkadotJs: (apiName) => getApi("polkadotJs", apiName),
      ethers: (apiName) => getApi("ethers", apiName),
      web3: (apiName) => getApi("web3", apiName),
      papi: (apiName) => getApi("papi", apiName),
    };
    const foundationHandlers = {
      dev: devHandler,
      chopsticks: chopsticksHandler,
      zombie: zombieHandler,
      read_only: readOnlyHandler,
    };
    const handler = foundationHandlers[foundationMethods];
    if (!handler) {
      throw new Error(`Unsupported foundation methods: ${foundationMethods}`);
    }
    handler({
      testCases,
      context,
      testCase,
      logger: logger6,
      ctx,
    });
  });
}
var loadParams = (config) => {
  const defaultParams = { maxConcurrent: 5, minTime: 100 };
  if (!config || config.rateLimiter === void 0 || config.rateLimiter === true) {
    return defaultParams;
  }
  if (config.rateLimiter === false) {
    return {};
  }
  if (typeof config.rateLimiter === "object") {
    return config.rateLimiter;
  }
};
var scheduleWithBottleneck = (api) => {
  return new Proxy(api, {
    get(target, propKey) {
      const origMethod = target[propKey];
      if (typeof origMethod === "function" && propKey !== "rpc" && propKey !== "tx") {
        return (...args) => {
          if (!limiter) {
            throw new Error("Limiter not initialized");
          }
          return limiter.schedule(() => origMethod.apply(target, args));
        };
      }
      return origMethod;
    },
  });
};
export { describeSuite };
