import type { MoonwallContract } from "../../api/types/index.js";
import chalk from "chalk";
import fs, { readFileSync } from "node:fs";
import path from "node:path";
import type { Abi } from "viem";
import { importJsonConfig } from "../../services/config/index.js";

type ContractInteractionModule = typeof import("../../contracts/contractInteraction.js");

const importContractInteraction = () => import("../../contracts/contractInteraction.js");

function getCompiledPath(contractName: string) {
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

  const compiledJsonPath = recursiveSearch(contractsDir, `${contractName}.json`);
  const solidityFilePath = recursiveSearch(contractsDir, `${contractName}.sol`);

  if (!compiledJsonPath && !solidityFilePath) {
    throw new Error(
      `Neither solidity contract ${contractName}.sol nor its compiled json exists in ${contractsDir}`
    );
  }
  if (!compiledJsonPath) {
    throw new Error(
      `Compiled contract ${contractName}.json doesn't exist\n` +
        `Please ${chalk.bgWhiteBright.blackBright("recompile contract")} ${contractName}.sol`
    );
  }
  return compiledJsonPath;
}

export function fetchCompiledContract<TAbi extends Abi>(
  contractName: string
): MoonwallContract<TAbi> {
  const compiledPath = getCompiledPath(contractName);
  const json = readFileSync(compiledPath, "utf8");
  const parsed = JSON.parse(json);
  return {
    abi: parsed.contract.abi,
    bytecode: parsed.byteCode,
    methods: parsed.contract.evm.methodIdentifiers,
    deployedBytecode: `0x${parsed.contract.evm.deployedBytecode.object}` as `0x${string}`,
  };
}

export function recursiveSearch(dir: string, filename: string): string | null {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);

    if (stats.isDirectory()) {
      const searchResult = recursiveSearch(filepath, filename);

      if (searchResult) {
        return searchResult;
      }
    } else if (stats.isFile() && file === filename) {
      return filepath;
    }
  }

  return null;
}

export const interactWithPrecompileContract = (async (
  ...args: Parameters<ContractInteractionModule["interactWithPrecompileContract"]>
) => (await importContractInteraction()).interactWithPrecompileContract(...args)) as ContractInteractionModule["interactWithPrecompileContract"];

export const interactWithContract = (async (
  ...args: Parameters<ContractInteractionModule["interactWithContract"]>
) => (await importContractInteraction()).interactWithContract(...args)) as ContractInteractionModule["interactWithContract"];

export const deployCreateCompiledContract = (async (
  ...args: Parameters<ContractInteractionModule["deployCreateCompiledContract"]>
) =>
  (await importContractInteraction()).deployCreateCompiledContract(
    ...(args as Parameters<ContractInteractionModule["deployCreateCompiledContract"]>)
  )) as ContractInteractionModule["deployCreateCompiledContract"];
