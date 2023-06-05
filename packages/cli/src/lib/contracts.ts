import fs from "fs";
import path from "path";
import { importJsonConfig } from "./configReader.js";
import chalk from "chalk";
import { Abi, PublicClient, WalletClient, getContract } from "viem";
import { ForgeContract, ContractDeploymentOptions, DevModeContext } from "@moonwall/types";
import { ALITH_PRIVATE_KEY, deployViemContract } from "@moonwall/util";

export async function fetchCompiledContract<TAbi extends Abi>(
  contractName: string
): Promise<ForgeContract<TAbi>> {
  const config = await importJsonConfig();
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

  const compiledJsonPath = await recursiveSearch(contractsDir, `${contractName}.json`);
  const solidityFilePath = await recursiveSearch(contractsDir, `${contractName}.sol`);

  if (!compiledJsonPath && !solidityFilePath) {
    throw new Error(
      `Neither solidity contract ${contractName}.sol nor its compiled json exists in ${contractsDir}`
    );
  } else if (!compiledJsonPath) {
    throw new Error(
      `Compiled contract ${contractName}.json doesn't exist\n` +
        `Please run ${chalk.bgWhiteBright.blackBright(
          "forge build"
        )} to compile contract ${contractName}.sol`
    );
  }

  const json = fs.readFileSync(compiledJsonPath, "utf8");
  const parsed = JSON.parse(json);
  return {
    abi: parsed.abi,
    bytecode: parsed.bytecode.object,
    methods: parsed.methodIdentifiers,
    deployedBytecode: parsed.deployedBytecode.object,
  };
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

async function recursiveSearch(dir: string, filename: string): Promise<string | null> {
  const files = await fs.promises.readdir(dir);

  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats = await fs.promises.stat(filepath);

    if (stats.isDirectory()) {
      const searchResult = await recursiveSearch(filepath, filename);

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
) {
  const { abi, bytecode, methods } = await fetchCompiledContract(contractName);

  const { privateKey = ALITH_PRIVATE_KEY as `0x${string}`, args = [], ...rest } = options || {};

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

  const contract = getContract({
    address: contractAddress!,
    abi: abi,
    publicClient: context.viemClient("public") as PublicClient,
    walletClient: context.viemClient("wallet") as WalletClient,
  });

  return {
    contractAddress: contractAddress as `0x${string}`,
    contract,
    logs,
    hash,
    status,
    abi,
    bytecode,
  };
}

// //TODO: Expand this to actually use options correctly
// //TODO: Fix
// export async function prepareToDeployCompiledContract<TOptions extends ContractDeploymentOptions>(
//   context: DevModeContext,
//   contractName: string,
//   options?: TOptions
// ) {
//   const compiled = getCompiled(contractName);
//   const callData = encodeDeployData({
//     abi: compiled.contract.abi,
//     bytecode: compiled.byteCode,
//     args: [],
//   }) as `0x${string}`;

//   const walletClient =
//     options && options.privateKey
//       ? createWalletClient({
//           transport: http(context.viemClient("public").transport.url),
//           account: privateKeyToAccount(options.privateKey),
//           chain: await getDevChain(context.viemClient("public").transport.url),
//         })
//       : context.viemClient("wallet");

//   const nonce =
//     options && options.nonce !== undefined
//       ? options.nonce
//       : await context.viemClient("public").getTransactionCount({ address: ALITH_ADDRESS });

//   // const hash = await walletClient.sendTransaction({ data: callData, nonce });
//   const rawTx = await createRawTransaction(context, { ...options, data: callData, nonce } as any);

//   const contractAddress = ("0x" +
//     keccak256(RLP.encode([ALITH_ADDRESS, nonce]))
//       .slice(12)
//       .substring(14)) as `0x${string}`;

//   return {
//     contractAddress,
//     callData,
//     abi: compiled.contract.abi,
//     bytecode: compiled.byteCode,
//   };
// }
