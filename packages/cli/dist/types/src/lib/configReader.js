import "@moonbeam-network/api-augment";
import { readFile, access } from "node:fs/promises";
import { readFileSync, existsSync, constants } from "node:fs";
import JSONC from "jsonc-parser";
import path, { extname } from "node:path";
let cachedConfig;
export async function configExists() {
  try {
    await access(process.env.MOON_CONFIG_PATH || "", constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
export function configSetup(args) {
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
      result = undefined;
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
      result = undefined;
      break;
  }
  return result;
}
export async function importConfig(configPath) {
  return await import(configPath);
}
export function isOptionSet(option) {
  const env = getEnvironmentFromConfig();
  const optionValue = traverseConfig(env, option);
  return optionValue !== undefined;
}
export function isEthereumZombieConfig() {
  const config = importJsonConfig();
  const env = getEnvironmentFromConfig();
  return env.foundation.type === "zombie" && !env.foundation.zombieSpec.disableDefaultEthProviders;
}
export function isEthereumDevConfig() {
  const config = importJsonConfig();
  const env = getEnvironmentFromConfig();
  return env.foundation.type === "dev" && !env.foundation.launchSpec[0].disableDefaultEthProviders;
}
export async function cacheConfig() {
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
export function getEnvironmentFromConfig() {
  const globalConfig = importJsonConfig();
  const config = globalConfig.environments.find(({ name }) => name === process.env.MOON_TEST_ENV);
  if (!config) {
    throw new Error(`Environment ${process.env.MOON_TEST_ENV} not found in config`);
  }
  return config;
}
export function importJsonConfig() {
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
export async function importAsyncConfig() {
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
export function loadEnvVars() {
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
      // Disabled until we only process Environment Config associated with the current Environment
      // if (envVarValue === undefined) {
      //   throw new Error(
      //     `❌ Moonwall config Environment Variable ${chalk.bgWhiteBright.redBright(
      //       group
      //     )} does not exist\n Please add ${chalk.bgWhiteBright.redBright(
      //       group
      //     )} to your .env file or change your config file.`
      //   );
      // }
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
  if (typeof configObj !== "object" || !configObj) return undefined;
  if (Object.prototype.hasOwnProperty.call(configObj, option)) {
    return configObj[option];
  }
  for (const key in configObj) {
    const result = traverseConfig(configObj[key], option);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}
export function parseZombieConfigForBins(zombieConfigPath) {
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
//# sourceMappingURL=configReader.js.map
