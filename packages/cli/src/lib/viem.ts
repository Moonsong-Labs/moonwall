import { Account, DeployContractParameters, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Chain, mainnet } from "viem/chains";
import { DevModeContext, EthTransactionType } from "@moonwall/types";
import { ALITH_PRIVATE_KEY } from "@moonwall/util";

/**
 * @name getDevChain
 * @description This function returns a development chain object for Moonbeam.
 * @param url - The WebSocket URL of the development chain.
 *
 * @returns Returns an object that represents the Moonbeam development chain.
 * The object includes properties such as the chain's ID, name, network, native currency, and RPC URLs.
 *
 * @property id - The ID of the development chain. For Moonbeam Dev, this is 1281.
 * @property name - The name of the development chain. For this function, it's "Moonbeam Dev".
 * @property network - The network name of the development chain. For this function, it's "moonbeam".
 * @property nativeCurrency - An object containing the native currency's details:
 *      - decimals: The number of decimal places the native currency supports.
 *      - name: The name of the native currency. For Moonbeam Dev, it's "Glimmer".
 *      - symbol: The symbol of the native currency. For Moonbeam Dev, it's "GLMR".
 * @property rpcUrls - An object that includes the RPC URLs for the chain:
 *      - public: The public HTTP URL(s) for the chain.
 *      - default: The default HTTP URL(s) for the chain.
 */
export async function getDevChain(url: string) {
  const httpUrl = url.replace("ws", "http");
  const block = { http: [httpUrl] };

  return {
    id: 1281,
    name: "Moonbeam Dev",
    network: "moonbeam",
    nativeCurrency: {
      decimals: 18,
      name: "Glimmer",
      symbol: "GLMR",
    },
    rpcUrls: {
      public: block,
      default: block,
    },
  } as const satisfies Chain;
}

export type ContractDeploymentOptions = DeepPartial<
  Omit<DeployContractParameters, "abi" | "bytecode" | "privateKey">
> & {
  privateKey?: `0x${string}`;
  args?: any[];
  txnType?: EthTransactionType;
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : DeepPartial<T[P]>;
};

/**
 * @name deployViemContract
 * @description This function deploys a contract to the Moonbeam development chain.
 * @param context - The DevModeContext object.
 * @param abi - The Application Binary Interface (ABI) of the contract.
 * @param bytecode - The compiled bytecode of the contract.
 * @param privateKey - The private key used for the deployment transaction (defaults to ALITH_PRIVATE_KEY).
 *
 * @returns Returns an object containing the deployed contract's address, the transaction status, and any logs.
 *
 * @throws This function will throw an error if the contract deployment fails.
 *
 * @async This function returns a Promise that resolves when the contract has been successfully deployed.
 *
 * @property contractAddress - The address of the deployed contract.
 * @property status - The status of the contract deployment transaction.
 * @property logs - Any logs produced during the contract deployment transaction.
 */
export async function deployViemContract<TOptions extends ContractDeploymentOptions>( // TODO: Make this generic
  context: DevModeContext,
  abi: any[],
  bytecode: `0x${string}`,
  options?: TOptions
) {
  const isLegacy = options?.txnType === "legacy" || options?.txnType === undefined;
  const isEIP1559 = options?.txnType === "eip1559";
  const isEIP2930 = options?.txnType === "eip2930";

  const url = context.viemClient("public").transport.url;

  const { privateKey = ALITH_PRIVATE_KEY, ...rest } = options || {};
  const blob = { ...rest, abi, bytecode, account: privateKeyToAccount(privateKey) };

  const account = privateKeyToAccount(ALITH_PRIVATE_KEY);
  const client = createWalletClient({
    transport: http(url),
    account,
    chain: await getDevChain(url),
  });

  // Enable when Viem allows it
  // switch (true) {
  //   case isLegacy:
  //     blob["gasPrice"] = options?.gasPrice || 10_000_000_000n;
  //     blob["gas"] = options?.gasLimit || 22318;
  //     break;
  //   case isEIP1559:
  //     blob["accessList"] = options?.accessList || [];
  //     blob["maxFeePerGas"] = options?.maxFeePerGas || 10_000_000_000n;
  //     blob["maxPriorityFeePerGas"] = options?.maxPriorityFeePerGas || 0n;
  //     blob["gasLimit"] = options?.gasLimit || 22318;
  //     break;
  //   case isEIP2930:
  //     blob["gasPrice"] = options?.gasPrice || 10_000_000_000n;
  //     blob["gasLimit"] = options?.gasLimit || 22318n;
  //     blob["accessList"] = options?.accessList || [];
  //     break;
  //   default:
  //     throw new Error("Invalid transaction type, undpate deployViemContract function");
  // }

  const hash = await client.deployContract(blob as DeployContractParameters);

  await context.createBlock();

  const { contractAddress, status, logs } = await context
    .viemClient("public")
    .getTransactionReceipt({ hash });

  return { contractAddress, status, logs, hash };
}
