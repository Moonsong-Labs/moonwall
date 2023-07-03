import { ContractDeploymentOptions, DevModeContext, MoonwallContract } from "@moonwall/types";
import { ALITH_PRIVATE_KEY, deployViemContract } from "@moonwall/util";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import type { Abi } from "viem";
import { Log, PublicClient, WalletClient, getContract } from "viem";
import { importJsonConfig } from "./configReader.js";

export async function fetchCompiledContract<TAbi extends Abi>(
  contractName: string
): Promise<MoonwallContract<TAbi>> {
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

  const compiledJsonPath = await recursiveSearch(contractsDir, `${contractName}.json`);
  const solidityFilePath = await recursiveSearch(contractsDir, `${contractName}.sol`);

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

  const json = fs.readFileSync(compiledJsonPath, "utf8");
  const parsed = JSON.parse(json);
  return {
    abi: parsed.contract.abi,
    bytecode: parsed.byteCode,
    methods: parsed.contract.evm.methodIdentifiers,
    deployedBytecode: ("0x" + parsed.contract.evm.deployedBytecode.object) as `0x${string}`,
  };
}

export async function recursiveSearch(dir: string, filename: string): Promise<string | null> {
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
): Promise<{
  contractAddress: `0x${string}`;
  contract: any;
  logs: Log<bigint, number>[];
  hash: `0x${string}`;
  status: "success" | "reverted";
  abi: Abi;
  bytecode: `0x${string}`;
  methods: any;
}> {
  const { abi, bytecode, methods } = await fetchCompiledContract(contractName);

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

  const contract = getContract({
    address: contractAddress!,
    abi: abi,
    publicClient: context.viem("public") as PublicClient,
    walletClient: context.viem("wallet") as WalletClient,
  });

  return {
    contractAddress: contractAddress as `0x${string}`,
    contract,
    logs,
    hash,
    status,
    abi,
    bytecode,
    methods,
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
//           transport: http(context.viem("public").transport.url),
//           account: privateKeyToAccount(options.privateKey),
//           chain: await getDevChain(context.viem("public").transport.url),
//         })
//       : context.viem("wallet");

//   const nonce =
//     options && options.nonce !== undefined
//       ? options.nonce
//       : await context.viem("public").getTransactionCount({ address: ALITH_ADDRESS });

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
