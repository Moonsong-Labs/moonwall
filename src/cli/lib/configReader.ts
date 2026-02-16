import type { MoonwallConfig } from "../../api/types/index.js";
import { readFile, access } from "node:fs/promises";
import { readFileSync, existsSync, constants } from "node:fs";
import JSONC from "jsonc-parser";
import path, { extname } from "node:path";
import { getCachedConfig, setCachedConfig } from "../../services/config/index.js";

// Re-export from services/config for backwards compatibility
export {
  importJsonConfig,
  cacheConfig,
  getEnvironmentFromConfig,
  isEthereumDevConfig,
  isEthereumZombieConfig,
  isOptionSet,
  loadEnvVars,
} from "../../services/config/index.js";

// CLI-specific functions below

export async function configExists() {
  try {
    await access(process.env.MOON_CONFIG_PATH || "", constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function configSetup(args: string[]) {
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

function replaceEnvVars(value: any): any {
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

export async function importConfig(configPath: string): Promise<MoonwallConfig> {
  return await import(configPath);
}

export async function importAsyncConfig(): Promise<MoonwallConfig> {
  const cached = getCachedConfig();
  if (cached) {
    return cached;
  }

  const configPath = process.env.MOON_CONFIG_PATH;

  if (!configPath) {
    throw new Error("No moonwall config path set. This is a defect, please raise it.");
  }

  const filePath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);

  try {
    const config = await parseConfig(filePath);
    const replacedConfig = replaceEnvVars(config) as MoonwallConfig;
    setCachedConfig(replacedConfig);
    return replacedConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`, { cause: e });
  }
}

export function parseZombieConfigForBins(zombieConfigPath: string) {
  const config = JSON.parse(readFileSync(zombieConfigPath, "utf8"));
  const commands: string[] = [];

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

  return [...new Set(commands)].toSorted();
}
