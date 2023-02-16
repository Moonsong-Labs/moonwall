import "@moonbeam-network/api-augment/moonbase";
import "@polkadot/api-augment/polkadot";
import fs from "node:fs/promises";
import { globalConfig } from "../../../../moonwall.config.js";
import { startVitest } from "vitest/node";
import { UserConfig } from "vitest";

export async function testCmd(args) {
  // For files selected by Config.Environments.testFileDir
  if (args.environment) {
    const env = globalConfig.environments.find(
      ({ name }) => name === args.environment
    );

    process.env.TEST_ENV = args.environment;

    // TODO: sort out reporter config
    const files = await fs.readdir(env.testFileDir);
    const options: UserConfig = {
      watch: false,
      globals: true,
      reporters: ["verbose"],
      setupFiles: ["src/cli/runner/internal/setupFixture.ts"],
      include: env.include
        ? env.include
        : ["**/{test,spec,test_,test-}*{ts,mts,cts}"],
    };

    const vitest = await startVitest("test", files, options);
    await vitest.close();
  } else {
    // For files selected by positional arg
    // TODO implement this code branch
  }
}
