import { ContractDeploymentOptions, DeepPartial, DevModeContext, GenericContext, ViemTransactionOptions } from "@moonwall/types";
import type { Abi } from "viem";
import {
  BlockTag,
  DeployContractParameters,
  TransactionSerializable,
  createWalletClient,
  hexToNumber,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Chain } from "viem/chains";
import { ALITH_ADDRESS, ALITH_PRIVATE_KEY } from "../constants/accounts.js";
import { directRpcRequest } from "./common.js";

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

/**
 * Derives a Viem chain object from a given HTTP endpoint.
 *
 * @export
 * @param endpoint The endpoint for the JSON RPC requests.
 * @returns A promise that resolves to an object satisfying the Chain interface, which includes
 * properties such as the chain id, chain name, network name, native currency information,
 * and RPC URLs.
 * @throws Will throw an error if the RPC request fails.
 * @example
 * const chain = await deriveViemChain('http://localhost:8545');
 */
export async function deriveViemChain(endpoint: string) {
  const httpEndpoint = endpoint.replace("ws", "http");
  const block = { http: [httpEndpoint] };

  const id = hexToNumber(await directRpcRequest(httpEndpoint, "eth_chainId"));
  const name = await directRpcRequest(httpEndpoint, "system_chain");
  const { tokenSymbol, tokenDecimals } = await directRpcRequest(httpEndpoint, "system_properties");

  return {
    id,
    name,
    network: name,
    nativeCurrency: {
      decimals: tokenDecimals,
      name: tokenSymbol,
      symbol: tokenSymbol,
    },
    rpcUrls: {
      public: block,
      default: block,
    },
  } as const satisfies Chain;
}

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
  abi: Abi,
  bytecode: `0x${string}`,
  options?: TOptions
) {
  // Enable when Viem allows it
  // const isLegacy = options?.txnType === "legacy" || options?.txnType === undefined;
  // const isEIP1559 = options?.txnType === "eip1559";
  // const isEIP2930 = options?.txnType === "eip2930";

  // const url = context.viem().transport.url;
  const url = context.viem().transport.url;

  const { privateKey = ALITH_PRIVATE_KEY, ...rest } = options || {};
  const blob = { ...rest, abi, bytecode, account: privateKeyToAccount(privateKey) };

  const account = privateKeyToAccount(ALITH_PRIVATE_KEY);
  const client = createWalletClient({
    transport: http(url),
    account,
    chain: await deriveViemChain(url),
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
    .viem()
    .getTransactionReceipt({ hash });

  return { contractAddress, status, logs, hash };
}

export type InputAmountFormats = number | bigint | string | `0x${string}`;

export type TransferOptions =
  | (Omit<TransactionSerializable, "to" | "value"> & {
      privateKey?: `0x${string}`;
    })
  | undefined;


/**
 * createRawTransfer function creates and signs a transfer, as a hex string, that can be submitted to the network via public client."
 *
 * @export
 * @template TOptions - Optional parameters of Viem's TransferOptions
 * @param {DevModeContext} context - the DevModeContext instance
 * @param {`0x${string}`} to - the destination address of the transfer
 * @param {InputAmountFormats} value - the amount to transfer. It accepts different formats including number, bigint, string or hexadecimal strings
 * @param {TOptions} [options] - (optional) additional transaction options
 * @returns {Promise<`0x${string}`>} - the signed raw transaction in hexadecimal string format
 */
export async function createRawTransfer<TOptions extends TransferOptions>(
  context: DevModeContext,
  to: `0x${string}`,
  value: InputAmountFormats,
  options?: TOptions
): Promise<`0x${string}`> {
  const transferAmount = typeof value === "bigint" ? value : BigInt(value);
  return await createViemTransaction(context, { ...options, to, value: transferAmount });
}

/**
 * createViemTransaction function creates and signs a raw transaction, as a hex string, that can be submitted to the network via public client."
 *
 * @export
 * @template TOptions - Optional parameters of Viem's TransactionOptions
 * @param {GenericContext} context - the GenericContext instance
 * @param {TOptions} options - transaction options including type, privateKey, value, to, chainId, gasPrice, estimatedGas, accessList, data
 * @returns {Promise<string>} - the signed raw transaction in hexadecimal string format
 */
export async function createViemTransaction<TOptions extends DeepPartial<ViemTransactionOptions>>(
  context: GenericContext,
  options: TOptions
): Promise<`0x${string}`> {
  const type = !!options && !!options.type ? options.type : "eip1559";
  const privateKey = !!options && !!options.privateKey ? options.privateKey : ALITH_PRIVATE_KEY;
  const account = privateKeyToAccount(privateKey);
  const value = options && options.value ? options.value : 0n;
  const to = options && options.to ? options.to : "0x0000000000000000000000000000000000000000";
  const chainId = await context.viem().getChainId();
  const txnCount = await context.viem().getTransactionCount({ address: account.address });
  const gasPrice = await context.viem().getGasPrice();
  const data = options && options.data ? options.data : "0x";

  const estimatedGas = options.skipEstimation
    ? 1_500_000n
    : await context.viem().estimateGas({ account: account.address, to, value, data });
  const accessList = options && options.accessList ? options.accessList : [];

  const txnBlob: TransactionSerializable =
    type === "eip1559"
      ? {
          to,
          value,
          maxFeePerGas: options.maxFeePerGas !== undefined ? options.maxFeePerGas : gasPrice,
          maxPriorityFeePerGas:
            options.maxPriorityFeePerGas !== undefined ? options.maxPriorityFeePerGas : gasPrice,
          gas: options.gas !== undefined ? options.gas : estimatedGas,
          nonce: options.nonce !== undefined ? options.nonce : txnCount,
          data,
          chainId,
          type,
        }
      : type === "legacy"
      ? {
          to,
          value,
          gasPrice: options.gasPrice !== undefined ? options.gasPrice : gasPrice,
          gas: options.gas !== undefined ? options.gas : estimatedGas,
          nonce: options.nonce !== undefined ? options.nonce : txnCount,
          data,
        }
      : type === "eip2930"
      ? {
          to,
          value,
          gasPrice: options.gasPrice !== undefined ? options.gasPrice : gasPrice,
          gas: options.gas !== undefined ? options.gas : estimatedGas,
          nonce: options.nonce !== undefined ? options.nonce : txnCount,
          data,
          chainId,
          type,
        }
      : {};

  if (type !== "legacy" && accessList.length > 0) {
    // @ts-ignore
    txnBlob["accessList"] = accessList;
  }
  return await account.signTransaction(txnBlob);
}

/**
 * checkBalance function checks the balance of a given account.
 *
 * @export
 * @param {DevModeContext} context - the DevModeContext instance
 * @param {`0x${string}`} [account=ALITH_ADDRESS] - the account address whose balance is to be checked. If no account is provided, it defaults to ALITH_ADDRESS
 * @returns {Promise<bigint>} - returns a Promise that resolves to the account's balance as a BigInt
 */
export async function checkBalance(
  context: DevModeContext,
  account: `0x${string}` = ALITH_ADDRESS,
  block: BlockTag | bigint = "latest"
): Promise<bigint> {
  return typeof block == "string"
    ? await context.viem().getBalance({ address: account, blockTag: block })
    : typeof block == "bigint"
    ? await context.viem().getBalance({ address: account, blockNumber: block })
    : await context.viem().getBalance({ address: account });
}

/**
 * Sends a raw signed transaction on to RPC node for execution.
 *
 * @async
 * @function
 * @param {DevModeContext} context - The DevModeContext for the Ethereum client interaction.
 * @param {`0x${string}`} rawTx - The signed and serialized hexadecimal transaction string.
 * @returns {Promise<any>} A Promise resolving when the transaction is sent or rejecting with an error.
 */
export async function sendRawTransaction(
  context: DevModeContext,
  rawTx: `0x${string}`
): Promise<any> {
  return await context
    .viem()
    .request({ method: "eth_sendRawTransaction", params: [rawTx] });
}
