import type { FoundationType, MoonwallConfig } from "@moonwall/types";
import fs from "node:fs/promises";
import { confirm, input, number } from "@inquirer/prompts";

export async function createFolders() {
  await fs.mkdir("scripts").catch(() => "scripts folder already exists, skipping");
  await fs.mkdir("tests").catch(() => "tests folder already exists, skipping");
  await fs.mkdir("tmp").catch(() => "tmp folder already exists, skipping");
}

export async function generateConfig(argv: { acceptAllDefaults?: boolean }) {
  interface ConfigAnswers {
    label: string;
    timeout: number;
    environmentName: string;
    foundation: FoundationType;
    useDocker?: boolean;
    testDir: string;
  }

  let answers: ConfigAnswers;

  try {
    await fs.access("moonwall.config.json");
    console.log("ℹ️  Config file already exists at this location. Quitting.");
    return;
  } catch (_) {
    // File does not exist — proceed with configuration
  }

  if (argv.acceptAllDefaults) {
    answers = {
      label: "moonwall_config",
      timeout: 30000,
      environmentName: "default_env",
      foundation: "dev",
      testDir: "tests/default/",
    };
  } else {
    while (true) {
      answers = {
        label: await input({
          message: "Provide a label for the config file",
          default: "moonwall_config",
        }),
        timeout:
          (await number({
            message: "Provide a global timeout value",
            default: 30000,
          })) ?? 30000,
        environmentName: await input({
          message: "Provide a name for this environment",
          default: "default_env",
        }),
        foundation: "dev",
        testDir: await input({
          message: "Provide the path for where tests for this environment are kept",
          default: "tests/default/",
        }),
      };

      const proceed = await confirm({
        message: "Would you like to generate this config? (no to restart from beginning)",
      });

      if (proceed) {
        break;
      }
      console.log("Restarting the configuration process...");
    }
  }

  const config = createSampleConfig({
    label: answers.label,
    timeout: answers.timeout,
    environmentName: answers.environmentName,
    foundation: answers.foundation,
    testDir: answers.testDir,
  });

  const JSONBlob = JSON.stringify(config, null, 3);
  await fs.writeFile("moonwall.config.json", JSONBlob, "utf-8");
  process.env.MOON_CONFIG_PATH = "./moonwall.config.json";
  await createSampleTest(answers.testDir);
  console.log("Test directory created at: ", answers.testDir);
  console.log(
    `You can now add tests to this directory and run them with 'bunx moonwall test ${answers.environmentName}'`
  );
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

export function createSampleConfig(options: {
  label: string;
  timeout: number;
  environmentName: string;
  foundation: FoundationType;
  testDir: string;
}): MoonwallConfig {
  return {
    $schema:
      "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/packages/types/config_schema.json",
    label: options.label,
    defaultTestTimeout: options.timeout,
    environments: [
      {
        name: options.environmentName,
        testFileDir: [options.testDir],
        multiThreads: false,
        foundation: {
          type: "dev",
          launchSpec: [
            {
              name: "moonbeam",
              useDocker: true,
              newRpcBehaviour: true,
              binPath: "moonbeamfoundation/moonbeam",
            },
          ],
        },
      },
    ],
  };
}

async function createSampleTest(directory: string) {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(`${directory}/sample.test.ts`, sampleTest, "utf-8");
}

const sampleTest = `import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "B01",
  title: "Sample test suite for moonbeam network",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {

    const ALITH_ADDRESS = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac"

    it({
      id: "T01",
      title: "Test that API is connected correctly",
      test: async () => {
        const chainName = context.pjsApi.consts.system.version.specName.toString();
        const specVersion = context.pjsApi.consts.system.version.specVersion.toNumber();
        expect(chainName.length).toBeGreaterThan(0)
        expect(chainName).toBe("moonbase")
        expect(specVersion).toBeGreaterThan(0)
      },
    });

    it({
      id: "T02",
      title: "Test that chain queries can be made",
      test: async () => {
        const balance = (await context.pjsApi.query.system.account(ALITH_ADDRESS)).data.free
        expect(balance.toBigInt()).toBeGreaterThan(0n)
      },
    });

  },
});

`;
