import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import fs from "node:fs/promises";
import { importConfig } from "../../../utils/configReader.js";
import { startVitest } from "vitest/node";
import { UserConfig } from "vitest";
import { MoonwallContext } from "../internal/globalContext.js";
import { } from "../../../../moonwall.config.js"

export async function testCmd(args) {
  const globalConfig = await importConfig("../../moonwall.config.js");
  const env = globalConfig.environments.find(
    ({ name }) => name === args.envName
  );
  process.env.TEST_ENV = args.envName;


  // TODO: sort out reporter config
  const files = await fs.readdir(env.testFileDir);
  const options: UserConfig = {
    watch: false,
    globals: true,
    reporters: ["verbose"],
    testTimeout: 10000,
    hookTimeout: 500000,
    setupFiles: ["src/cli/runner/internal/setupFixture.ts"],
    include: env.include
      ? env.include
      : ["**/{test,spec,test_,test-}*{ts,mts,cts}"],
  };

  try {
    const vitest = await startVitest("test", files, options);
    await vitest.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    MoonwallContext.destroy();
    process.exit(1);
  }
}
