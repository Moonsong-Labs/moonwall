import type { FoundationType, MoonwallConfig } from "@moonwall/types";
export declare function createFolders(): Promise<void>;
export declare function generateConfig(argv: { acceptAllDefaults?: boolean }): Promise<void>;
export declare function createConfig(options: {
  label: string;
  timeout: number;
  environmentName: string;
  foundation: FoundationType;
  testDir: string;
}): MoonwallConfig;
export declare function createSampleConfig(options: {
  label: string;
  timeout: number;
  environmentName: string;
  foundation: FoundationType;
  testDir: string;
}): MoonwallConfig;
