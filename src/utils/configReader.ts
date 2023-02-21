import { MoonwallConfig } from "../types/config.js";
import fs from "fs/promises";
import util from "util";

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


export async function importConfig(configPath: string):Promise<MoonwallConfig>{
  const {globalConfig} = await import(configPath);
  return globalConfig;
}