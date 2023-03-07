import { MoonwallConfig } from '../types/config.js';
import fs from 'fs/promises';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

export async function loadConfig(path: string): Promise<MoonwallConfig> {
  if (
    !(await fs
      .access(path)
      .then(() => true)
      .catch(() => false))
  ) {
    throw new Error(`Moonwall Config file ${path} cannot be found`);
  }

  const file = await fs.readFile(path, { encoding: 'utf-8' });
  const json: MoonwallConfig = JSON.parse(file);
  return json;
}

export async function importConfig(configPath: string): Promise<MoonwallConfig> {
  return await import(configPath);
}

export async function importJsonConfig(): Promise<MoonwallConfig> {
  const filePath = path.join(process.cwd(), 'moonwall.config.json');
  try {
    const file = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(file);
    return json as MoonwallConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`);
  }
}
