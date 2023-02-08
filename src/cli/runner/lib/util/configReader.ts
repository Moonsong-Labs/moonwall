import { MoonwallConfig } from '../types';
import fs from 'fs/promises';

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
  return JSON.parse(file) as MoonwallConfig;
}


export async function buildFoundations(config: MoonwallConfig) {}