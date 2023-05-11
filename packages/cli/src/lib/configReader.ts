import "@moonbeam-network/api-augment";
import { MoonwallConfig } from "../types/config.js";
import fs from "fs/promises";
import path from "path";

export async function loadConfig(path: string): Promise<MoonwallConfig> {
  if (
    !(await fs
      .access(path)
      .then(() => true)
      .catch(() => false))
  ) {
    throw new Error(`Moonwall Config file ${path} cannot be found`);
  }

  const file = await fs.readFile(path, { encoding: "utf-8" });
  const json: MoonwallConfig = JSON.parse(file);
  return json;
}

export async function importConfig(configPath: string): Promise<MoonwallConfig> {
  return await import(configPath);
}

export async function importJsonConfig(): Promise<MoonwallConfig> {
  const filePath = path.join(process.cwd(), "moonwall.config.json");
  try {
    const file = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(file);
    return json as MoonwallConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`);
  }
}

export async function loadEnvVars(): Promise<void> {
  const globalConfig = await importJsonConfig();
  const env = globalConfig.environments.find(({ name }) => name === process.env.MOON_TEST_ENV)!;
  env.envVars &&
    env.envVars.forEach((envVar) => {
      const [key, value] = envVar.split("=");
      process.env[key] = value;
    });
}
