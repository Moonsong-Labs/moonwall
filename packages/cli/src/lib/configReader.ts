import "@moonbeam-network/api-augment";
import { MoonwallConfig } from "@moonwall/types";
import { readFile } from "fs/promises";
import { readFileSync } from "fs";
import JSONC from "jsonc-parser";
import path, { extname } from "path";

async function parseConfig(filePath: string) {
  let result: any;

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
function parseConfigSync(filePath: string) {
  let result: any;

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

export async function importConfig(configPath: string): Promise<MoonwallConfig> {
  return await import(configPath);
}

export function isOptionSet(option: string): boolean {
  const config = importJsonConfig();
  const env = config.environments.find((env) => env.name == process.env.MOON_TEST_ENV)!;
  const optionValue = traverseConfig(env, option);

  return optionValue !== undefined;
}

export function isEthereumZombieConfig(): boolean {
  const config = importJsonConfig();
  const env = config.environments.find((env) => env.name == process.env.MOON_TEST_ENV)!;
  return env.foundation.type == "zombie" && !env.foundation.zombieSpec.disableDefaultEthProviders;
}

export function isEthereumDevConfig(): boolean {
  const config = importJsonConfig();
  const env = config.environments.find((env) => env.name == process.env.MOON_TEST_ENV)!;
  return env.foundation.type == "dev" && !env.foundation.launchSpec[0].disableDefaultEthProviders;
}

export function importJsonConfig(): MoonwallConfig {
  if (globalThis.config) {
    return replaceEnvVars(globalThis.config);
  }

  const configPath = process.env.MOON_CONFIG_PATH!;
  const filePath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);

  try {
    const config = parseConfigSync(filePath);
    const replacedConfig = replaceEnvVars(config);
    return replacedConfig as MoonwallConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`);
  }
}

export async function importAsyncConfig() {
  if (globalThis.config) {
    return replaceEnvVars(globalThis.config);
  }

  const configPath = process.env.MOON_CONFIG_PATH!;
  const filePath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);

  try {
    const config = await parseConfig(filePath);
    const replacedConfig = replaceEnvVars(config);

    return replacedConfig as MoonwallConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`);
  }
}

export function loadEnvVars(): void {
  const globalConfig = importJsonConfig();
  const env = globalConfig.environments.find(({ name }) => name === process.env.MOON_TEST_ENV)!;
  env.envVars &&
    env.envVars.forEach((envVar) => {
      const [key, value] = envVar.split("=");
      process.env[key] = value;
    });
}

function replaceEnvVars(value: any): any {
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
  } else if (Array.isArray(value)) {
    return value.map(replaceEnvVars);
  } else if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceEnvVars(v)]));
  } else {
    return value;
  }
}

function traverseConfig(configObj: any, option: string): any {
  if (typeof configObj !== "object" || configObj === null) return undefined;

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

export function parseZombieConfigForBins(zombieConfigPath: string) {
  const config = JSON.parse(readFileSync(zombieConfigPath, "utf8"));
  const commands: string[] = [];

  if (config.relaychain && config.relaychain.default_command) {
    commands.push(path.basename(config.relaychain.default_command));
  }

  if (config.parachains) {
    for (const parachain of config.parachains) {
      if (parachain.collator && parachain.collator.command) {
        commands.push(path.basename(parachain.collator.command));
      }
    }
  }

  return [...new Set(commands)].sort();
}
