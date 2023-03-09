import segfaultHandler from "node-segfault-handler";
import { importJsonConfig } from "../lib/configReader.js";
import { startVitest } from "vitest/node";
import { setTimeout } from "timers/promises";
import { UserConfig, Vitest } from "vitest";
import { MoonwallContext } from "../lib/globalContext.js";
import { Environment } from "../types/config.js";
import url from "url";
import path from "path";
import chalk from "chalk";

export async function testCmd(envName) {
  segfaultHandler.registerHandler();
  const globalConfig = await importJsonConfig();
  const env = globalConfig.environments.find(({ name }) => name === envName)!;

  if (!!!env) {
    throw new Error(
      `No environment found in config for: ${chalk.bgWhiteBright.blackBright(
        envName
      )}`
    );
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
  const currDir = url.fileURLToPath(new URL(".", import.meta.url));
  const setupPath = path.join(currDir, "internal", "setupFixture");
  const options: UserConfig = {
    watch: false,
    globals: true,
    reporters: env.html ? ["verbose", "html"] : ["verbose"],
    testTimeout: 10000,
    // deps:{experimentalOptimizer:{}},
    hookTimeout: 500000,
    setupFiles: [setupPath],
    include: env.include
      ? env.include
      : ["**/{test,spec,test_,test-}*{ts,mts,cts}"],
  };

  if (env.threads && env.threads > 1) {
    options.threads = true;
    options.minThreads = env.threads;
  } else {
    // Even when running tests sequentially, we still want it in multi-threaded
    // mode for its state separation properties
    options.minThreads = 1;
    options.maxThreads = 1;
  }
  try {
    const folders = env.testFileDir.map((folder) =>
      path.join("/", folder, "/")
    );
    return await startVitest("test", folders, options);
  } catch (e) {
    throw new Error(e);
  }
}
