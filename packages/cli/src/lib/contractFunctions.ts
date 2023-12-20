import {
  ContractCallOptions,
  ContractDeploymentOptions,
  DevModeContext,
  GenericContext,
  MoonwallContract,
  PrecompileCallOptions,
} from "@moonwall/types";
import {
  ALITH_PRIVATE_KEY,
  PRECOMPILES,
  createEthersTransaction,
  createViemTransaction,
  deployViemContract,
} from "@moonwall/util";
import chalk from "chalk";
import { Interface, InterfaceAbi, Wallet } from "ethers";
import fs, { readFileSync } from "fs";
import path from "path";
import type { Abi } from "viem";
import { Log, decodeFunctionResult, encodeFunctionData, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { importJsonConfig } from "./configReader";

function getCompiledPath(contractName: string) {
  const config = importJsonConfig();
  const contractsDir = config.environments.find((env) => env.name === process.env.MOON_TEST_ENV)
    ?.contracts;

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
  } else if (!compiledJsonPath) {
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
    deployedBytecode: ("0x" + parsed.contract.evm.deployedBytecode.object) as `0x${string}`,
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

export async function interactWithPrecompileContract(
  context: GenericContext,
  callOptions: PrecompileCallOptions
) {
  const { precompileName, ...rest } = callOptions;

  const precompileInfo = PRECOMPILES[precompileName];
  if (!precompileInfo) {
    throw new Error(`No precompile found with the name: ${precompileName}`);
  }

  const [contractAddress, contractName] = Array.isArray(precompileInfo)
    ? precompileInfo
    : [precompileInfo, precompileName];

  return await interactWithContract(context, {
    ...rest,
    contractName,
    contractAddress: contractAddress as `0x${string}`,
  });
}

export async function interactWithContract(
  context: GenericContext,
  callOptions: ContractCallOptions
) {
  const {
    contractName,
    contractAddress,
    functionName,
    args = [],
    web3Library = "viem",
    gas = "estimate",
    value = 0n,
    privateKey = ALITH_PRIVATE_KEY,
    rawTxOnly = false,
    call = false,
  } = callOptions;
  const { abi } = fetchCompiledContract(contractName);
  const data = encodeFunctionData({
    abi,
    functionName,
    args,
  });

  const account = privateKeyToAccount(privateKey);
  const gasParam =
    gas === "estimate"
      ? await context
          .viem()
          .estimateGas({ account: account.address, to: contractAddress, value: 0n, data })
      : gas > 0n
        ? gas
        : 200_000n;

  if (!call && rawTxOnly) {
    return web3Library === "viem"
      ? createViemTransaction(context, {
          to: contractAddress,
          data,
          gas: gasParam,
          privateKey,
          value,
        })
      : createEthersTransaction(context, {
          to: contractAddress,
          data,
          gas: gasParam,
          value: toHex(value),
          privateKey,
        });
  }

  if (call) {
    if (web3Library === "viem") {
      const result = await context
        .viem()
        .call({ account: account.address, to: contractAddress, value: 0n, data, gas: gasParam });
      return decodeFunctionResult({ abi, functionName, data: result.data! });
    } else {
      const result = await context.ethers().call({
        from: account.address,
        to: contractAddress,
        value: toHex(value),
        data,
        gasLimit: toHex(gasParam),
      });
      return new Interface(abi as InterfaceAbi).decodeFunctionResult(functionName, result);
    }
  } else if (!rawTxOnly) {
    if (web3Library === "viem") {
      const hash = await (context.viem() as any).sendTransaction({
        account: account,
        to: contractAddress,
        value,
        data,
        gas: gasParam,
      });
      return hash;
    } else {
      const signer = new Wallet(privateKey, context.ethers().provider);
      const { hash } = await signer.sendTransaction({
        from: account.address,
        to: contractAddress,
        value: toHex(value),
        data,
        gasLimit: toHex(gasParam),
      });
      return hash;
    }
  } else {
    throw new Error("This should never happen, if it does there's a logic error in the code");
  }
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
