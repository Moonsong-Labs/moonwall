import type { MoonwallConfig, Environment } from "../../api/types/index.js";
import { readFileSync } from "node:fs";
import JSONC from "jsonc-parser";
import path, { extname } from "node:path";
import { regex } from "arkregex";

/** Matches ${VAR_NAME} environment variable references */
const envVarRegex = regex("\\$\\{([^}]+)}", "g");

let cachedConfig: MoonwallConfig | undefined;

/**
 * Sets the cached config. Used by async loaders to populate the cache.
 * @internal
 */
export function setCachedConfig(config: MoonwallConfig): void {
  cachedConfig = config;
}

/**
 * Gets the cached config if available.
 * @internal
 */
export function getCachedConfig(): MoonwallConfig | undefined {
  return cachedConfig;
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

function replaceEnvVars(value: any): any {
  if (typeof value === "string") {
    return value.replace(envVarRegex, (match, group) => {
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

/**
 * Imports the Moonwall config from the path specified in MOON_CONFIG_PATH.
 * Uses a cached version if available.
 */
export function importJsonConfig(): MoonwallConfig {
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
    cachedConfig = replacedConfig as MoonwallConfig;
    return cachedConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`, { cause: e });
  }
}

/**
 * Caches the config from the MOON_CONFIG_PATH environment variable.
 */
export function cacheConfig() {
  const configPath = process.env.MOON_CONFIG_PATH;

  if (!configPath) {
    throw new Error(`Environment ${process.env.MOON_TEST_ENV} not found in config`);
  }
  const filePath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  try {
    const config = parseConfigSync(filePath);
    const replacedConfig = replaceEnvVars(config);
    cachedConfig = replacedConfig as MoonwallConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`, { cause: e });
  }
}

/**
 * Gets the current environment configuration based on MOON_TEST_ENV.
 */
export function getEnvironmentFromConfig(): Environment {
  const globalConfig = importJsonConfig();
  const config = globalConfig.environments.find(({ name }) => name === process.env.MOON_TEST_ENV);

  if (!config) {
    throw new Error(`Environment ${process.env.MOON_TEST_ENV} not found in config`);
  }

  return config;
}

/**
 * Checks if the current environment is an Ethereum-compatible dev config.
 */
export function isEthereumDevConfig(): boolean {
  const env = getEnvironmentFromConfig();
  return env.foundation.type === "dev" && !env.foundation.launchSpec[0].disableDefaultEthProviders;
}

/**
 * Checks if the current environment is an Ethereum-compatible zombie config.
 */
export function isEthereumZombieConfig(): boolean {
  const env = getEnvironmentFromConfig();
  return env.foundation.type === "zombie" && !env.foundation.zombieSpec.disableDefaultEthProviders;
}

/**
 * Checks if a specific option is set in the current environment config.
 */
export function isOptionSet(option: string): boolean {
  const env = getEnvironmentFromConfig();
  const optionValue = traverseConfig(env, option);

  return optionValue !== undefined;
}

function traverseConfig(configObj: any, option: string): any {
  if (typeof configObj !== "object" || !configObj) return undefined;

  if (Object.hasOwn(configObj, option)) {
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

/**
 * Loads environment variables defined in the current environment config.
 */
export function loadEnvVars(): void {
  const env = getEnvironmentFromConfig();

  for (const envVar of env.envVars || []) {
    const [key, value] = envVar.split("=");
    process.env[key] = value;
  }
}
