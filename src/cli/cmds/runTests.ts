import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import { importConfig } from "../../utils/configReader.js";
import { startVitest } from "vitest/node";
import { UserConfig } from "vitest";
import { MoonwallContext } from "../internal/globalContext.js";
import { Environment } from "../../types/config.js";

export async function testCmd(args) {
  const globalConfig = await importConfig("../../moonwall.config.js");
  const env = globalConfig.environments.find(
    ({ name }) => name === args.envName
  )!;
  process.env.TEST_ENV = args.envName;

  try {
    const vitest = await executeTests(env);
    await vitest!.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    MoonwallContext.destroy();
    process.exit(1);
  }
}

export async function executeTests(env: Environment) {
  // TODO: sort out reporter config
  const options: UserConfig = {
    watch: false,
    globals: true,
    reporters: env.html ? ["verbose", "html"] : ["verbose"],
    testTimeout: 10000,

    hookTimeout: 500000,
    setupFiles: ["src/cli/internal/setupFixture.ts"],
    include: env.include
      ? env.include
      : ["**/{test,spec,test_,test-}*{ts,mts,cts}"],
  };

  if (env.threads && env.threads > 1) {
    options.threads = true;
    options.minThreads = env.threads;
  } else {
    options.threads = false;
  }

  return await startVitest("test", env.testFileDir, options);
}
