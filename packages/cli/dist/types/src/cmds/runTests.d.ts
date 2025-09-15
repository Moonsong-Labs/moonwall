import type { Environment } from "@moonwall/types";
import type { UserConfig, Vitest } from "vitest/node";
export declare function testCmd(envName: string, additionalArgs?: testRunArgs): Promise<boolean>;
export type testRunArgs = {
  testNamePattern?: string;
  subDirectory?: string;
  shard?: string;
  update?: boolean;
  vitestPassthroughArgs?: string[];
};
export declare function executeTests(
  env: Environment,
  testRunArgs?: testRunArgs & UserConfig
): Promise<Vitest>;
