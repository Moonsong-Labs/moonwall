import type { FoundationType, MoonwallConfig } from "@moonwall/types";
import fs from "node:fs/promises";
import { input, number, confirm } from "@inquirer/prompts";

export async function createFolders() {
  await fs.mkdir("scripts").catch(() => "scripts folder already exists, skipping");
  await fs.mkdir("tests").catch(() => "tests folder already exists, skipping");
  await fs.mkdir("tmp").catch(() => "tmp folder already exists, skipping");
}

export async function generateConfig() {
  for (;;) {
    if (await fs.access("moonwall.config.json").catch(() => true)) {
      const label = await input({
        message: "Provide a label for the config file",
        default: "moonwall_config",
      });

      const timeout = await number({
        message: "Provide a global timeout value",
        default: 30000,
      });

      const environmentName = await input({
        message: "Provide a name for this environment",
        default: "default_env",
      });

      const foundation = (await input({
        message: "What type of network foundation is this?",
        default: "dev",
      })) as FoundationType;

      const testDir = await input({
        message: "Provide the path for where tests for this environment are kept",
        default: "tests/",
      });

      const proceed = await confirm({
        message: "Would you like to generate this config? (no to restart from beginning)",
      });

      if (proceed === false) {
        continue;
      }

      const JSONBlob = JSON.stringify(
        createConfig({
          label,
          timeout: timeout ?? 30000,
          environmentName,
          foundation,
          testDir,
        }),
        null,
        3
      );

      await fs.writeFile("moonwall.config", textBlob + JSONBlob, "utf-8");
      process.env.MOON_CONFIG_PATH = "./moonwall.config";
      break;
    }
    console.log("ℹ️  Config file already exists at this location. Quitting.");
    return;
  }
  console.log("Goodbye! 👋");
}

export function createConfig(options: {
  label: string;
  timeout: number;
  environmentName: string;
  foundation: FoundationType;
  testDir: string;
}): MoonwallConfig {
  return {
    label: options.label,
    defaultTestTimeout: options.timeout,
    environments: [
      {
        name: options.environmentName,
        testFileDir: [options.testDir],
        foundation: {
          type: options.foundation as any,
        } as any,
      },
    ],
  };
}

const textBlob = `// This Moonwall Config file should be modified to include all types
// of environments you wish to test against.

// For more information on how to configure Moonwall, please visit:
// https://moonsong-labs.github.io/moonwall/config/intro.html\n`;
