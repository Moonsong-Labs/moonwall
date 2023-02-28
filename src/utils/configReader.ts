import { MoonwallConfig } from "../types/config.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

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

export async function importConfig(
  configPath: string
): Promise<MoonwallConfig> {
  return await import(configPath);
}

export async function importConfigDefault() {
  const filePath = path.join(process.cwd(), "moonwall.config.ts");
  try {
    const imp = await import(filePath);
    return imp.default();
  } catch (e) {
    console.log(e);
    throw new Error(`File not found at ${filePath}`);
  }
}


export function createConfig(){
  
}