import { Abi, DeployContractParameters } from "viem";
import { DeepPartial } from "./helpers.js";
import { EthTransactionType } from "./config.js";
import { TransactionType } from "./eth.js";

/**
 * Type representing a Moonwall Contract.
 *
 * @typedef {Object} MoonwallContract
 * @property {TAbi} abi - The contract's ABI (Application Binary Interface).
 * @property {`0x${string}`} bytecode - The bytecode of the contract.
 * @property {Record<string, string>[]} methods - An array of contract's methods.
 * @property {`0x${string}`} deployedBytecode - The bytecode of the deployed contract.
 */
export type MoonwallContract<TAbi extends Abi> = {
  abi: TAbi;
  bytecode: `0x${string}`;
  methods: Record<string, string>[];
  deployedBytecode: `0x${string}`;
};

/**
 * Type representing a compiled contract.
 *
 * @typedef {Object} CompiledContract
 * @property {`0x${string}`} byteCode - The bytecode of the contract.
 * @property {ContractObject<TAbi>} contract - The compiled contract object.
 * @property {string} sourceCode - The source code of the contract.
 */
export type CompiledContract<TAbi extends Abi> = {
  byteCode: `0x${string}`;
  contract: ContractObject<TAbi>;
  sourceCode: string;
};

/**
 * Type representing a contract object.
 *
 * @typedef {Object} ContractObject
 * @property {TAbi} abi - The contract's ABI (Application Binary Interface).
 * @property {any} devdoc - Developer documentation for the contract.
 * @property {any} evm - Information about the EVM (Ethereum Virtual Machine) aspect of the contract.
 * @property {any} ewasm - Information about the EWASM (Ethereum Web Assembly) aspect of the contract.
 * @property {any} metadata - The contract's metadata.
 * @property {any} storageLayout - The layout of the contract's storage.
 * @property {any} userdoc - User documentation for the contract.
 */
export type ContractObject<TAbi extends Abi> = {
  abi: TAbi;
  devdoc: any;
  evm: any;
  ewasm: any;
  metadata: any;
  storageLayout: any;
  userdoc: any;
};

/**
 * Type representing options for a contract deployment.
 *
 * @typedef {Object} ContractDeploymentOptions
 * @property {`0x${string}`} privateKey - (optional) The private key to use for the deployment.
 * @property {any[]} args - (optional) Any arguments to pass to the contract's constructor.
 * @property {TransactionType} txnType - (optional) The type of the transaction.
 */
export type ContractDeploymentOptions = DeepPartial<
  Omit<DeployContractParameters, "abi" | "bytecode" | "privateKey">
> & {
  privateKey?: `0x${string}`;
  args?: any[];
  txnType?: TransactionType;
};
