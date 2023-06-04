import fs from "fs";
import path from "path";
import { importJsonConfig } from "./configReader.js";
import chalk from "chalk";
import type { Abi } from "viem";
import { ForgeContract } from "@moonwall/types";

export async function fetchCompiledContract<TAbi extends Abi>(
  contractFile: string,
  contractName?: string
): Promise<ForgeContract<TAbi>> {
  const config = await importJsonConfig();
  const contractsDir = config.environments.find(
    (env) => env.name === process.env.MOON_TEST_ENV
  )?.contracts;

  const name = contractName || contractFile;

  if (!contractsDir) {
    throw new Error(
      `Contracts directory not found for environment config ${process.env.MOON_TEST_ENV}\n` +
        `Please specify path to Foundry directory at:  ${chalk.bgWhiteBright.blackBright(
          "moonwall.config.json > environments > contracts"
        )}`
    );
  }

  const compiledPath = path.join(
    process.cwd(),
    contractsDir,
    "/out",
    `/${contractFile}.sol`,
    name + ".json"
  );

  if (!fs.existsSync(compiledPath)) {
    if (!solidityFileExists(path.join(process.cwd(), contractsDir), contractFile)) {
      throw new Error(`Solidity contract ${contractFile}.sol doesn't exist in ${contractsDir}`);
    }

    throw new Error(
      `Compiled contract ${name}.json doesn't exist in ${compiledPath}\n` +
        `Please run ${chalk.bgWhiteBright.blackBright(
          "forge build"
        )} to compile contract ${contractFile}.sol`
    );
  }

  const json = fs.readFileSync(compiledPath, "utf8");
  const parsed = JSON.parse(json);
  return { abi: parsed.abi, bytecode: parsed.bytecode.object, methods: parsed.methodIdentifiers };
}

function solidityFileExists(dir: string, contractFile: string): boolean {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (solidityFileExists(res, contractFile)) return true;
    } else if (entry.isFile() && entry.name === contractFile + ".sol") {
      return true;
    }
  }

  return false;
}
