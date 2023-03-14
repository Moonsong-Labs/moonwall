import { importJsonConfig } from "../lib/configReader.js";
import { startVitest } from "vitest/node";
import { UserConfig, Vitest } from "vitest";
import { MoonwallContext } from "../lib/globalContext.js";
import { Environment } from "../types/config.js";
import { dirname } from "path";
import { fileURLToPath } from "url";
import path from "path";
import chalk from "chalk";

export async function testCmd(envName) {
  const globalConfig = await importJsonConfig();
  const env = globalConfig.environments.find(({ name }) => name === envName)!;

  if (!!!env) {
    throw new Error(`No environment found in config for: ${chalk.bgWhiteBright.blackBright(envName)}`);
  }

  process.env.TEST_ENV = envName;
  try {
    const vitest = await executeTests(env);
    await vitest.close();
  } catch (e) {
    console.error(e);
    MoonwallContext.destroy();
  }
}

export async function executeTests(env: Environment): Promise<Vitest> {
  const _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));

  const setupPath = path.join(_dirname, "internal", "setupFixture");
  const options: UserConfig = {
    watch: false,
    globals: true,
    reporters: env.html ? ["verbose", "html"] : ["verbose"],
    testTimeout: 10000,
    hookTimeout: 500000,
    setupFiles: [setupPath],
    useAtomics: false,
    threads: true,
    include: env.include ? env.include : ["**/{test,spec,test_,test-}*{ts,mts,cts}"],
  };

  if (env.threads && env.threads > 1 && process.env.SINGLE_THREAD !== "true") {
    options.minThreads = env.threads;
  } else {
    options.threads = false;
    process.env.RECYCLE = "true";
  }
  try {
    const folders = env.testFileDir.map((folder) => path.join("/", folder, "/"));
    return await startVitest("test", folders, options);
  } catch (e) {
    throw new Error(e);
  }
}
