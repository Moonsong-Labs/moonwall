import type { Web3 } from "web3";
import { type AccessListish } from "ethers";
import type { Logger } from "pino";
/**
 * @name TransactionOptions
 * @description Ethereum Transaction options
 * @param from: From address
 * @param to: To address
 * @param privateKey: Private key of the account to sign the transaction
 * @param nonce: Nonce of the transaction
 * @param gas: Gas limit of the transaction
 * @param gasPrice: Gas price of the transaction
 * @param maxFeePerGas: Max fee per gas of the transaction
 * @param maxPriorityFeePerGas: Max priority fee per gas of the transaction
 * @param value: Value of the transaction
 * @param data: Data of the transaction
 * @param accessList: Access list of the transaction
 */
export interface TransactionOptions {
  from?: string;
  to?: string;
  privateKey?: string;
  nonce?: number | bigint;
  gas?: string | number | bigint;
  gasPrice?: string | number | bigint;
  maxFeePerGas?: string | number | bigint;
  maxPriorityFeePerGas?: string | number | bigint;
  value?: string | number;
  data?: string;
  accessList?: AccessListish;
}
export declare const DEFAULT_TRANSACTION: {};
/**
 * @name ContractCreation
 * @description Contract creation options
 * @param byteCode: Bytecode of the contract
 * @param abi: ABI of the contract
 * @param arguments: Arguments of the contract
 */
export interface ContractCreation {
  byteCode: string;
  abi: any;
  arguments?: any[];
}
/**
 * @name EthTester
 * @description Class to generate Ethereum transactions for testing purposes
 */
export declare class EthTester {
  /**
   * @name defaultType: Default type of Ethereum transaction
   */
  private defaultType;
  /**
   * @name defaultType: Default account to sign Ethereum transactions (usually sudo account)
   */
  private defaultAccount;
  /**
   * @name logger: Logger to use
   */
  private logger;
  /**
   * @name web3: Web3 instance
   */
  web3: Web3;
  /**
   * @name constructor
   * @param web3: Web3 instance
   * @param privateKey: Private key of the default account
   * @param logger: Logger to use
   * @param type: Default type of Ethereum transaction
   * @returns Web3Tester instance
   * @description Creates a new Web3Tester instance
   * @example
   * const web3 = new Web3("http://localhost:9944");
   * const web3Tester = new Web3Tester(web3, alith.privateKey, logger, "EIP1559");
   * const rawTransaction = await web3Tester.genSignedTransfer({
   *  to: baltathar.address,
   *  value: web3.utils.toWei("1", "ether"),
   * });
   */
  constructor(
    web3: Web3,
    privateKey: string,
    logger: Logger,
    type?: "Legacy" | "EIP2930" | "EIP1559"
  );
  /**
   * @name genSignedTransaction
   * @param options: Transaction options
   * @param txType: Type of Ethereum transaction
   * @returns Signed transaction
   * @description Generates a signed Ethereum transaction
   * @example
   * const rawTransaction = await web3Tester.genSignedTransaction({
   *   to: baltathar.address,
   *   to: authorMapping.address,
   *   data: authorMapping.encodeFunctionData("setKeys", [keys]),
   * });
   */
  genSignedTransaction: (
    options?: TransactionOptions,
    txType?: "Legacy" | "EIP2930" | "EIP1559"
  ) => Promise<string>;
  /**
   * @name genSignedTransfer
   * @param to Address of the recipient
   * @param value Amount of Wei to send
   * @param options Transaction options
   * @description Generates a signed Ethereum transactiosn
   * @returns Signed transaction
   */
  genSignedTransfer: (
    to: string,
    value: number | string | bigint,
    options?: TransactionOptions
  ) => Promise<string>;
  /**
   * @name genSignedContractDeployment
   * @description Generates a signed contract deployment transaction
   * @param contractCreation Contract creation object
   * @param options Transaction options
   * @returns Signed transaction
   */
  genSignedContractDeployment: (
    contractCreation: ContractCreation,
    options?: TransactionOptions
  ) => Promise<string>;
  /**
   * @name sendSignedTransaction
   * @description Sends a signed transaction, without waiting for it to be produced.
   * @param rawTransaction Signed transaction
   * @returns Transaction JSON RPC response
   */
  sendSignedTransaction: (rawTransaction: string | PromiseLike<string>) => Promise<any>;
}
