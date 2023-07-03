import { ContractDeploymentOptions, DevModeContext, MoonwallContract } from "@moonwall/types";
import { ALITH_PRIVATE_KEY, deployViemContract } from "@moonwall/util";
import chalk from "chalk";
import fs from "fs";
import { readFileSync } from "fs";
import path from "path";
import type { Abi } from "viem";
import { Log } from "viem";
import { importJsonConfig } from "./configReader.js";

export function fetchCompiledContract<TAbi extends Abi>(
  contractName: string
): MoonwallContract<TAbi> {
  const config = importJsonConfig();
  const contractsDir = config.environments.find(
    (env) => env.name === process.env.MOON_TEST_ENV
  )?.contracts;

  if (!contractsDir) {
    throw new Error(
      `Contracts directory not found for environment config ${process.env.MOON_TEST_ENV}\n` +
        `Please specify path to Foundry directory at:  ${chalk.bgWhiteBright.blackBright(
          "moonwall.config.json > environments > contracts"
        )}`
    );
  }

  const compiledJsonPath =  recursiveSearch(contractsDir, `${contractName}.json`);
  const solidityFilePath =  recursiveSearch(contractsDir, `${contractName}.sol`);

  if (!compiledJsonPath && !solidityFilePath) {
    throw new Error(
      `Neither solidity contract ${contractName}.sol nor its compiled json exists in ${contractsDir}`
    );
  } else if (!compiledJsonPath) {
    throw new Error(
      `Compiled contract ${contractName}.json doesn't exist\n` +
        `Please ${chalk.bgWhiteBright.blackBright("recompile contract")} ${contractName}.sol`
    );
  }

  const json = readFileSync(compiledJsonPath, "utf8");
  const parsed = JSON.parse(json);
  return {
    abi: parsed.contract.abi,
    bytecode: parsed.byteCode,
    methods: parsed.contract.evm.methodIdentifiers,
    deployedBytecode: ("0x" + parsed.contract.evm.deployedBytecode.object) as `0x${string}`,
  };
}

export function recursiveSearch(dir: string, filename: string): string | null {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats =  fs.statSync(filepath);

    if (stats.isDirectory()) {
      const searchResult =  recursiveSearch(filepath, filename);

      if (searchResult) {
        return searchResult;
      }
    } else if (stats.isFile() && file === filename) {
      return filepath;
    }
  }

  return null;
}

export async function deployCreateCompiledContract<TOptions extends ContractDeploymentOptions>(
  context: DevModeContext,
  contractName: string,
  options?: TOptions
): Promise<{
  contractAddress: `0x${string}`;
  logs: Log<bigint, number>[];
  hash: `0x${string}`;
  status: "success" | "reverted";
  abi: Abi;
  bytecode: `0x${string}`;
  methods: any;
}> {
  const { abi, bytecode, methods } = fetchCompiledContract(contractName);

  const { privateKey = ALITH_PRIVATE_KEY, args = [], ...rest } = options || ({} as any);

  const blob: ContractDeploymentOptions = {
    ...rest,
    privateKey,
    args,
  };

  const { contractAddress, logs, status, hash } = await deployViemContract(
    context,
    abi,
    bytecode,
    blob
  );

  return {
    contractAddress: contractAddress as `0x${string}`,
    logs,
    hash,
    status,
    abi,
    bytecode,
    methods,
  };
}