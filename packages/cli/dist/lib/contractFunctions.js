// src/lib/contractFunctions.ts
import {
  ALITH_PRIVATE_KEY,
  PRECOMPILES,
  createEthersTransaction,
  createViemTransaction,
  deployViemContract,
} from "@moonwall/util";
import chalk from "chalk";
import { Interface, Wallet } from "ethers";
import fs, { readFileSync as readFileSync2 } from "fs";
import path2 from "path";
import { decodeFunctionResult, encodeFunctionData, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// src/lib/configReader.ts
import "@moonbeam-network/api-augment";
import { readFile, access } from "fs/promises";
import { readFileSync, existsSync, constants } from "fs";
import JSONC from "jsonc-parser";
import path, { extname } from "path";
var cachedConfig;
function parseConfigSync(filePath) {
  let result;
  const file = readFileSync(filePath, "utf8");
  switch (extname(filePath)) {
    case ".json":
      result = JSON.parse(file);
      break;
    case ".config":
      result = JSONC.parse(file);
      break;
    default:
      result = void 0;
      break;
  }
  return result;
}
function importJsonConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const configPath = process.env.MOON_CONFIG_PATH;
  if (!configPath) {
    throw new Error("No moonwall config path set. This is a defect, please raise it.");
  }
  const filePath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  try {
    const config = parseConfigSync(filePath);
    const replacedConfig = replaceEnvVars(config);
    cachedConfig = replacedConfig;
    return cachedConfig;
  } catch (e) {
    console.error(e);
    throw new Error(`Error import config at ${filePath}`);
  }
}
function replaceEnvVars(value) {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (match, group) => {
      const envVarValue = process.env[group];
      return envVarValue || match;
    });
  }
  if (Array.isArray(value)) {
    return value.map(replaceEnvVars);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceEnvVars(v)]));
  }
  return value;
}

// src/lib/contractFunctions.ts
function getCompiledPath(contractName) {
  const config = importJsonConfig();
  const contractsDir = config.environments.find(
    (env) => env.name === process.env.MOON_TEST_ENV
  )?.contracts;
  if (!contractsDir) {
    throw new Error(
      `Contracts directory not found for environment config ${process.env.MOON_TEST_ENV}
Please specify path to Foundry directory at:  ${chalk.bgWhiteBright.blackBright(
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
      `Compiled contract ${contractName}.json doesn't exist
Please ${chalk.bgWhiteBright.blackBright("recompile contract")} ${contractName}.sol`
    );
  }
  return compiledJsonPath;
}
function fetchCompiledContract(contractName) {
  const compiledPath = getCompiledPath(contractName);
  const json = readFileSync2(compiledPath, "utf8");
  const parsed = JSON.parse(json);
  return {
    abi: parsed.contract.abi,
    bytecode: parsed.byteCode,
    methods: parsed.contract.evm.methodIdentifiers,
    deployedBytecode: `0x${parsed.contract.evm.deployedBytecode.object}`,
  };
}
function recursiveSearch(dir, filename) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path2.join(dir, file);
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
async function interactWithPrecompileContract(context, callOptions) {
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
    contractAddress,
  });
}
async function interactWithContract(context, callOptions) {
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
      ? await context.viem().estimateGas({
          account: account.address,
          to: contractAddress,
          value: 0n,
          data,
        })
      : gas > 0n
        ? gas
        : 200000n;
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
      const result2 = await context.viem().call({
        account: account.address,
        to: contractAddress,
        value: 0n,
        data,
        gas: gasParam,
      });
      if (!result2.data) {
        throw new Error("No data field returned from call");
      }
      return decodeFunctionResult({ abi, functionName, data: result2.data });
    }
    const result = await context.ethers().call({
      from: account.address,
      to: contractAddress,
      value: toHex(value),
      data,
      gasLimit: toHex(gasParam),
    });
    return new Interface(abi).decodeFunctionResult(functionName, result);
  }
  if (!rawTxOnly) {
    if (web3Library === "viem") {
      const hash2 = await context.viem().sendTransaction({
        account,
        to: contractAddress,
        value,
        data,
        gas: gasParam,
      });
      return hash2;
    }
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
  throw new Error("This should never happen, if it does there's a logic error in the code");
}
async function deployCreateCompiledContract(context, contractName, options) {
  const { abi, bytecode, methods } = fetchCompiledContract(contractName);
  const { privateKey = ALITH_PRIVATE_KEY, args = [], ...rest } = options || {};
  const blob = {
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
    contractAddress,
    logs,
    hash,
    status,
    abi,
    bytecode,
    methods,
  };
}
export {
  deployCreateCompiledContract,
  fetchCompiledContract,
  interactWithContract,
  interactWithPrecompileContract,
  recursiveSearch,
};
