import  { Web3,JsonRpcResponse } from "web3";
import { AccessListish } from "ethers";
import { Debugger } from "debug";

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
  nonce?: number | BigInt;
  gas?: string | number | BigInt;
  gasPrice?: string | number | BigInt;
  maxFeePerGas?: string | number | BigInt;
  maxPriorityFeePerGas?: string | number | BigInt;
  value?: string | number;
  data?: string;
  accessList?: AccessListish;
}

/**
 * @name EthTester
 * @description Class to generate Ethereum transactions for testing purposes
 */
export class EthTester {
  /**
   * @name defaultType: Default type of Ethereum transaction
   */
  private defaultType: "Legacy" | "EIP2930" | "EIP1559";

  /**
   * @name defaultType: Default account to sign Ethereum transactions (usually sudo account)
   */
  private defaultAccount: ReturnType<Web3["eth"]["accounts"]["privateKeyToAccount"]>;

  /**
   * @name logger: Logger to use
   */
  private logger: Debugger;

  /**
   * @name web3: Web3 instance
   */
  public web3: Web3;

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
    logger: Debugger,
    type: "Legacy" | "EIP2930" | "EIP1559" = "Legacy"
  ) {
    this.web3 = web3;
    this.logger = logger;
    this.defaultType = type;
    this.defaultAccount = web3.eth.accounts.privateKeyToAccount(privateKey);
  }

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
  genSignedTransaction = async (
    options: TransactionOptions,
    txType?: "Legacy" | "EIP2930" | "EIP1559"
  ): Promise<string> => {
    const type = txType || this.defaultType;
    const isLegacy = type === "Legacy";
    const isEip2930 = type === "EIP2930";
    const isEip1559 = type === "EIP1559";

    // Checks transaction shouldn't have both Legacy and EIP1559 fields
    if (options.gasPrice && options.maxFeePerGas) {
      throw new Error(`txn has both gasPrice and maxFeePerGas!`);
    }
    if (options.gasPrice && options.maxPriorityFeePerGas) {
      throw new Error(`txn has both gasPrice and maxPriorityFeePerGas!`);
    }

    // Converts BigInt to hex string. This is needed because Web3 doesn't support BigInt
    if (typeof options.gasPrice === "bigint") {
      options.gasPrice = "0x" + options.gasPrice.toString(16);
    }
    if (typeof options.maxFeePerGas === "bigint") {
      options.maxFeePerGas = "0x" + options.maxFeePerGas.toString(16);
    }
    if (typeof options.maxPriorityFeePerGas === "bigint") {
      options.maxPriorityFeePerGas = "0x" + options.maxPriorityFeePerGas.toString(16);
    }

    let maxFeePerGas;
    let maxPriorityFeePerGas;
    if (options.gasPrice) {
      maxFeePerGas = options.gasPrice;
      maxPriorityFeePerGas = options.gasPrice;
    } else {
      maxFeePerGas = options.maxFeePerGas || BigInt(await this.web3.eth.getGasPrice());
      maxPriorityFeePerGas = options.maxPriorityFeePerGas || 0;
    }

    // Sets default values
    const gasPrice =
      options.gasPrice !== undefined
        ? options.gasPrice
        : "0x" + BigInt(await this.web3.eth.getGasPrice()).toString(16);
    const value = options.value !== undefined ? options.value : "0x00";
    const from = options.from || this.defaultAccount.address;
    const privateKey =
      options.privateKey !== undefined ? options.privateKey : this.defaultAccount.privateKey;

    // Always execute estimateGas. Allows to retrieve potential errors
    let error: any;
    const estimatedGas = await this.web3.eth
      .estimateGas({
        from: from,
        to: options.to,
        data: options.data,
      })
      .catch((e: any) => {
        error = e;
        return 0;
      });

    // Instead of hardcoding the gas limit, we estimate the gas
    const gas = options.gas || estimatedGas;

    const accessList = options.accessList || [];
    const nonce =
      options.nonce != null
        ? options.nonce
        : await this.web3.eth.getTransactionCount(from, "pending");

    let data: any;
    let rawTransaction: string;
    if (isLegacy) {
      data = {
        from,
        to: options.to,
        value: value && value.toString(),
        gasPrice,
        gas,
        nonce: nonce,
        data: options.data,
      };
      const tx = await this.web3.eth.accounts.signTransaction(data, privateKey);
      rawTransaction = tx.rawTransaction;
    } else {
      const chainId = await this.web3.eth.getChainId();
      if (isEip2930) {
        data = {
          from,
          to: options.to,
          value: value && value.toString(),
          gasPrice,
          gasLimit: gas,
          nonce: nonce,
          data: options.data,
          accessList,
          chainId,
          type: 1,
        };
      } else if (isEip1559) {
        data = {
          from,
          to: options.to,
          value: value && value.toString(),
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit: gas,
          nonce: nonce,
          data: options.data,
          accessList,
          chainId,
          type: 2,
        };
      }
      const tx = await this.web3.eth.accounts.signTransaction(data, privateKey);
      rawTransaction = tx.rawTransaction;
    }

    this.logger(
      `Tx [${/:([0-9]+)$/.exec((this.web3.currentProvider as any).host)?.[1]}] ` +
        `from: ${data.from.substr(0, 5) + "..." + data.from.substr(data.from.length - 3)}, ` +
        (data.to
          ? `to: ${data.to.substr(0, 5) + "..." + data.to.substr(data.to.length - 3)}, `
          : "") +
        (data.value ? `value: ${data.value.toString()}, ` : "") +
        (data.gasPrice ? `gasPrice: ${data.gasPrice.toString()}, ` : "") +
        (data.maxFeePerGas ? `maxFeePerGas: ${data.maxFeePerGas.toString()}, ` : "") +
        (data.maxPriorityFeePerGas
          ? `maxPriorityFeePerGas: ${data.maxPriorityFeePerGas.toString()}, `
          : "") +
        (data.accessList ? `accessList: ${data.accessList.toString()}, ` : "") +
        (data.gas ? `gas: ${data.gas.toString()}, ` : "") +
        (data.nonce ? `nonce: ${data.nonce.toString()}, ` : "") +
        (!data.data
          ? ""
          : `data: ${
              data.data.length < 50
                ? data.data
                : data.data.substr(0, 5) + "..." + data.data.substr(data.data.length - 3)
            }, `) +
        (error ? `ERROR: ${error.toString()}, ` : "")
    );
    return rawTransaction;
  };

  /**
   * @name genSignedTransfer
   * @param to Address of the recipient
   * @param value Amount of Wei to send
   * @param options Transaction options
   * @description Generates a signed Ethereum transactiosn
   * @returns Signed transaction
   */
  genSignedTransfer = async (
    to: string,
    value: number | string | BigInt,
    options: TransactionOptions
  ): Promise<string> => {
    return await this.genSignedTransaction({
      ...options,
      value: value.toString(),
      to,
    });
  };

  /**
   * @name sendSignedTransaction
   * @description Sends a signed transaction, without waiting for it to be produced.
   * @param rawTransaction Signed transaction
   * @returns Transaction JSON RPC response
   */
  sendSignedTransaction = async (
    rawTransaction: string | PromiseLike<string>
  ): Promise<JsonRpcResponse> => {
    return new Promise<JsonRpcResponse>(async (resolve, reject) => {
      if (typeof this.web3.currentProvider == "string") {
        reject("Web3 provider is not a valid provider");
        return;
      }
      (this.web3.currentProvider as any).send(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_sendRawTransaction",
          params: [await rawTransaction],
        },
        (error, result) => {
          if (error) {
            reject(`Failed to send signed transaction: ${error.message || error.toString()}`);
          }
          resolve(result as JsonRpcResponse);
        }
      );
    });
  };
}
