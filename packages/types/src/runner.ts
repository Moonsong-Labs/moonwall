import { ApiPromise } from "@polkadot/api";
import { ApiTypes } from "@polkadot/api/types";
import { KeyringPair } from "@polkadot/keyring/types";
import { Debugger } from "debug";
import { Signer, TransactionRequest } from "ethers";
import {
  Abi,
  Account,
  Log,
  PublicActions,
  TransactionSerializable,
  Transport,
  WalletClient,
} from "viem";
import { Chain } from "viem/chains";
import { Web3 } from "web3";
import { FoundationType } from "./config";
import { BlockCreation, BlockCreationResponse, ChopsticksBlockCreation } from "./context";
import { ContractDeploymentOptions } from "./contracts";
import { TransactionType } from "./eth";
import { CallType } from "./foundations";
import { DeepPartial } from "./helpers";

/**
 * @name CustomTest
 * @description The custom test type.
 * @property id - A unique identifier for the test.
 * @property title - The title of the test.
 * @property test - A function to execute the test.
 * @property modifier - An optional modifier to control test execution ("only" or "skip").
 * @property minRtVersion - The minimum runtime version required for the test.
 * @property chainType - The chain type required for the test.
 * @property notChainType - The chain type excluded from the test.
 * @property timeout - The test timeout value.
 */
export interface CustomTest {
  (params: {
    id: string;
    title: string;
    test: (vitestContext: any) => void;
    modifier?: "only" | "skip";
    minRtVersion?: number;
    chainType?: "moonriver" | "moonbeam" | "moonbase";
    notChainType?: "moonbeam" | "moonriver" | "moonbase";
    timeout?: number;
  }): void;
}

export type FoundationMethod = "dev" | "chopsticks" | "zombie" | "read_only" | "fork";

export type ChainType = "moonbeam" | "moonriver" | "moonbase";

export type FoundationContextMap = {
  [K in FoundationMethod]: K extends "dev"
    ? DevModeContext
    : K extends "chopsticks"
      ? ChopsticksContext
      : K extends "zombie"
        ? ZombieContext
        : K extends "read_only"
          ? ReadOnlyContext
          : /* default: */ GenericContext;
};

export type TestContextMap = {
  [K in FoundationMethod]: ITestContext<FoundationContextMap[K]>;
};

export type TestCasesFn<T extends FoundationType> = (params: {
  context: GenericContext & FoundationContextMap[T];
  it: (params: ITestCase) => void;
  log: Debugger;
}) => void;

// TODO: Extend to include skipIf() and runIf()
export type TestCaseModifier = "only" | "skip";

export interface ITestCase {
  id: string;
  title: string;
  test: (vitestContext: any) => void;
  modifier?: TestCaseModifier;
  minRtVersion?: number;
  chainType?: "moonbeam" | "moonriver" | "moonbase";
  notChainType?: "moonbeam" | "moonriver" | "moonbase";
  // networkName?: string; TODO: Implement this
  timeout?: number;
}

export type FoundationHandler<T extends FoundationType> = (params: {
  testCases: TestCasesFn<T>;
  context: GenericContext;
  testCase: (params: ITestCase) => void;
  logger: () => Debugger;
  ctx?: any;
}) => void;

export type ITestSuiteType<T extends FoundationMethod> = {
  id: string;
  title: string;
  testCases: (TestContext: TestContextMap[T]) => void;
  foundationMethods: T;
  options?: object;
  minRtVersion?: number;
  chainType?: ChainType;
  notChainType?: ChainType;
};

interface ITestContext<T extends GenericContext> {
  context: T;
  it: CustomTest;
  log: Debugger;
}

/**
 * @name DevTestContext
 * @description The context for tests running in development mode.
 * @property context - The context for the development mode.
 * @property it - The CustomTest function for the test.
 * @property log - The Debugger instance for logging.
 */
export type DevTestContext = ITestContext<DevModeContext>;

/**
 * @name ReadOnlyTestContext
 * @description The context for tests running in read-only mode.
 * @property context - The context for the read-only mode.
 * @property it - The CustomTest function for the test.
 * @property log - The Debugger instance for logging.
 */
export type ReadOnlyTestContext = ITestContext<ReadOnlyContext>;

/**
 * @name ChopsticksTestContext
 * @description The context for tests running with chopsticks.
 * @property context - The context for the chopsticks mode.
 * @property it - The CustomTest function for the test.
 * @property log - The Debugger instance for logging.
 */
export type ChopsticksTestContext = ITestContext<ChopsticksContext>;

// /**
//  * @name ZombieTestContext
//  * @description The context for tests running with zombie.
//  * @property context - The context for the zombie mode.
//  * @property it - The CustomTest function for the test.
//  * @property log - The Debugger instance for logging.
//  */
export type ZombieTestContext = ITestContext<ZombieContext>;

/**
 * @name GenericTestContext
 * @description The base test context for other contexts to extend, not to be used directly.
 * @property context - The base context for other contexts to extend, not to be used directly.
 * @property it - The CustomTest function for the test.
 * @property log - The Debugger instance for logging.
 */
export type GenericTestContext = ITestContext<GenericContext>;

/**
 * @name UpgradePreferences
 * @description The upgrade preferences object.
 * @property runtimeName - The name of the runtime.
 * @property runtimeTag - The tag of the runtime.
 * @property from - The KeyringPair to be used for the upgrade.
 * @property waitMigration - A flag to indicate whether to wait for migration.
 * @property useGovernance - A flag to indicate whether to use governance for the upgrade.
 * @property localPath - The local path for the runtime.
 * @property logger - The debugger instance for logging.
 */
export interface UpgradePreferences {
  runtimeName?: "moonbase" | "moonriver" | "moonbeam";
  runtimeTag?: "local" | string;
  from?: KeyringPair;
  waitMigration?: boolean;
  useGovernance?: boolean;
  localPath?: string;
  logger?: Debugger;
}

/**
 * ViemClient - Combined type that contains both Wallet and Public viem client actions
 */
export type ViemClient = WalletClient<Transport, Chain, Account> & PublicActions;

/**
 * GenericContext - Interface that encapsulates all the common methods and properties needed for all tests.
 */
export interface GenericContext {
  api(type: "polkadotJs", name?: string): ApiPromise;
  api(type: "ethers", name?: string): Signer;
  api(type: "web3", name?: string): Web3;
  api(type: "viem", name?: string): ViemClient;
  viem(name?: string): ViemClient;
  polkadotJs(apiName?: string): ApiPromise;
  ethers(name?: string): Signer;
  web3(name?: string): Web3;
}

/**
 * ReadOnlyContext - Interface that extends from GenericContext and includes the method for waiting a certain number of blocks.
 */
export interface ReadOnlyContext extends GenericContext {
  waitBlock: (
    blocksToWaitFor?: number,
    chain?: string,
    mode?: "height" | "quantity"
  ) => Promise<void>;
}

/**
 * ZombieContext - Interface that extends from GenericContext and includes methods for managing runtime upgrades and node operations within a blockchain network.
 */
export interface ZombieContext extends GenericContext {
  /**
   * Initiates the runtime upgrade process with the provided upgrade preferences.
   *
   * @param {UpgradePreferences} options The configuration options for the upgrade, including runtime details and migration settings.
   * @returns {Promise<void>} A promise that resolves when the upgrade process has been initiated.
   */
  upgradeRuntime: (options: UpgradePreferences) => Promise<void>;

  /**
   * ⚠️ WARNING: This doesn't seem to be working yet. ⚠️
   *
   * Checks if the specified node is running.
   *
   * @param {string} nodeName The name of the node to check.
   * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether the node is up and running.
   */
  isUp?: (nodeName: string) => Promise<boolean>;

  /**
   * Restarts the node with the given name.
   *
   * @param {string} nodeName The name of the node to restart.
   * @returns {Promise<void>} A promise that resolves when the node restart has been completed.
   */
  restartNode: (nodeName: string) => Promise<void>;

  /**
   * * ⚠️ WARNING: This doesn't seem to be working yet. ⚠️
   *
   * Pauses the node with the specified name.
   *
   * @param {string} nodeName The name of the node to pause.
   * @returns {Promise<void>} A promise that resolves when the node has been successfully paused.
   */
  pauseNode?: (nodeName: string) => Promise<void>;

  /**
   * ⚠️ WARNING: This doesn't seem to be working yet. ⚠️
   *
   * Resumes the operation of a paused node with the given name.
   *
   * @param {string} nodeName The name of the node to resume.
   * @returns {Promise<void>} A promise that resolves when the node has resumed operations.
   */
  resumeNode?: (nodeName: string) => Promise<void>;

  /**
   * Terminates the node with the provided name.
   *
   * @param {string} nodeName The name of the node to terminate.
   * @returns {Promise<void>} A promise that resolves when the node has been successfully terminated.
   */
  killNode: (nodeName: string) => Promise<void>;

  /**
   * Waits for a specified number of blocks before resolving. This can be based on block height or quantity, depending on the mode.
   *
   * @param {number} [blocksToWaitFor] The number of blocks to wait for before the promise resolves. If not provided, defaults to some predetermined quantity.
   * @param {string} [chain] The name of the blockchain to monitor for block production.
   * @param {"height" | "quantity"} [mode] The mode to determine the block wait criteria - by height or by quantity.
   * @returns {Promise<void>} A promise that resolves after waiting for the specified number of blocks.
   */
  waitBlock: (
    blocksToWaitFor?: number,
    chain?: string,
    mode?: "height" | "quantity"
  ) => Promise<void>;
}

/**
 * ChopsticksContext - Interface that extends from GenericContext and includes methods for creating a block, setting storage, and upgrading runtime.
 */
export interface ChopsticksContext extends GenericContext {
  /**
   * Creates a block based on the given options.
   *
   * @param {ChopsticksBlockCreation} [options] Optional parameters for block creation.
   * @returns {Promise<{ result: string }>} A Promise that resolves to an object containing the result string.
   */
  createBlock: (options?: ChopsticksBlockCreation) => Promise<{ result: string }>;

  /**
   * Sets the storage based on the provided parameters.
   *
   * @param {Object} params The parameters required for setting storage.
   * @param {string} [params.providerName] Optional name of the provider.
   * @param {string} params.module The name of the module.
   * @param {string} params.method The method to be called.
   * @param {any} params.methodParams The parameters required for the method.
   * @returns {Promise<void>} A Promise that resolves once the storage has been set.
   */
  setStorage: (params: {
    providerName?: string;
    module: string;
    method: string;
    methodParams: any;
  }) => Promise<void>;

  /**
   * Upgrades the runtime.
   *
   * @returns {Promise<void>} A Promise that resolves once the runtime has been upgraded.
   */
  upgradeRuntime: () => Promise<void>;

  /**
   * Getter that returns true if System.Account is AccountId20 (Ethereum Account length is 20 bytes).
   */
  isEthereumChain: boolean;

  /**
   * Getter that returns an object with the default accounts already generated.
   */
  keyring: { alice: KeyringPair; bob: KeyringPair; charlie: KeyringPair; dave: KeyringPair };

  /**
   * Property that returns true if System.Account is AccountId32 (Substrate Account length is 32 bytes).
   */
  isSubstrateChain: boolean;

  /**
   * Default getter for a connected PolkadotJs ApiPromise instance
   */
  pjsApi: ApiPromise;
}

/**
 * DevModeContext - Interface that extends from GenericContext and includes a method for creating a block.
 */
export interface DevModeContext extends GenericContext {
  /**
   * Default getter for a connected PolkadotJs ApiPromise instance
   */
  pjsApi: ApiPromise;

  /**
   * Getter that returns true if System.Account is AccountId20 (Ethereum Account length is 20 bytes).
   */
  isEthereumChain: boolean;

  /**
   * Getter that returns an object with the default accounts already generated.
   */
  keyring: { alice: KeyringPair; bob: KeyringPair; charlie: KeyringPair; dave: KeyringPair };

  /**
   * Property that returns true if System.Account is AccountId32 (Substrate Account length is 32 bytes).
   */
  isSubstrateChain: boolean;
  /**
   * Creates a block with given transactions and options.
   *
   * @template ApiType Type of API to be used.
   * @template Calls Type of calls to be made, could be a single CallType or an array of CallType.
   * @param {Calls} transactions An optional array of transactions.
   * @param {BlockCreation} options Optional parameters for block creation.
   * @returns {Promise<BlockCreationResponse<ApiType, Calls>>} A Promise that resolves to a BlockCreationResponse.
   */
  createBlock<ApiType extends ApiTypes, Calls extends CallType<ApiType> | CallType<ApiType>[]>(
    transactions?: Calls,
    options?: BlockCreation
  ): Promise<BlockCreationResponse<ApiType, Calls>>;

  /**
   * Creates a raw Ethereum transaction based on the given options.
   *
   * @template TOptions Type of option parameters to be used. Use libraryType to specify which web3 library to use
   * (viem or ethers), otherwise will default to viem.
   * @param {TOptions} options Options for creating a transaction.
   * @returns {Promise<`0x${string}`>} A Promise that resolves to a raw transaction string prefixed with '0x'.
   */
  createTxn?<
    TOptions extends
      | (DeepPartial<ViemTransactionOptions> & {
          libraryType?: "viem";
        })
      | (EthersTransactionOptions & {
          libraryType: "ethers";
        }),
  >(
    options: TOptions
  ): Promise<`0x${string}`>;

  /**
   * Execute a non-state changing transaction to a precompiled contract address (i.e. read).
   *
   * @param {PrecompileCallOptions} callOptions The options for the contract call.
   * @returns {Promise<unknown>} A Promise that resolves to the return data from the contract call.
   */
  readPrecompile?(callOptions: PrecompileCallOptions): Promise<unknown>;

  /**
   * Submit a state-changing transaction to a precompiled contract address.
   *
   * @param {PrecompileCallOptions} callOptions The options for the contract call.
   * @returns {Promise<`0x${string}`>} The transaction hash that resolves after the write operation has been completed.
   */
  writePrecompile?(callOptions: PrecompileCallOptions): Promise<`0x${string}`>;

  /**
   * Execute a non-state changing transaction to a deployed contract address (i.e. read).
   *
   * @param {ContractCallOptions} callOptions The options for the contract call.
   * @returns {Promise<unknown>} A Promise that resolves to the return data from the contract call.
   */
  readContract?(callOptions: ContractCallOptions): Promise<unknown>;

  /**
   * Submit a state-changing transaction to a deployed contract address.
   *
   * @param {ContractCallOptions} callOptions The options for the contract call.
   * @returns {Promise<`0x${string}`>} The transaction hash that resolves after the write operation has been completed.
   */
  writeContract?(callOptions: ContractCallOptions): Promise<`0x${string}`>;

  /**
   * Deploy a contract to the local dev network.
   *
   * @param {ContractDeploymentOptions} options The options necessary for the contract deployment.
   * @returns {Promise<{contractAddress: `0x${string}` | null, status: "success" | "reverted", logs: Log<bigint, number>[], hash: `0x${string}`}>} A Promise that resolves to an object containing the contract address, the status of the deployment, logs, and the transaction hash of the deployment.
   */
  deployContract?(
    contractName: string,
    options?: ContractDeploymentOptions
  ): Promise<{
    contractAddress: `0x${string}`;
    logs: Log<bigint, number>[];
    hash: `0x${string}`;
    status: "success" | "reverted";
    abi: Abi;
    bytecode: `0x${string}`;
    methods: any;
  }>;
}

export type ViemTransactionOptions = TransactionSerializable & {
  privateKey?: `0x${string}`;
  skipEstimation?: boolean;
  txnType?: TransactionType;
};

export type EthersTransactionOptions = TransactionRequest & {
  txnType?: TransactionType;
  privateKey?: `0x${string}`;
};

export type PrecompileCallOptions = Omit<
  ContractCallOptions,
  "contractName" | "contractAddress"
> & {
  /**  The name of the Pre-compiled contract you want to interact with.
   * Compiled contracts are a set of contract-like code that is
   * embedded into the Moonbeam runtime.
   */
  precompileName: string;
};

export interface ContractCallOptions {
  /**
   * The name of the compiled contract you want to interact with.
   * Compiled contracts are solidity contracts already compiled by solc
   * into JSON files accessible to this project. Refer to Moonwall help
   * docs for more info.
   */
  contractName: string;

  /**
   * The address of the deployed contract you want to interact with.
   */
  contractAddress: `0x${string}`;

  /**
   * The name of the function in the contract that you want to call.
   */
  functionName: string;

  /**
   * If set to true, only the raw transaction data will be returned,
   * and the transaction will not be sent. This can be useful if you
   * want to sign the transaction yourself or send it at a later time.
   */
  rawTxOnly?: boolean;

  /**
   * If set to true, the function call will be executed as a "call" and
   * will not create a transaction on the blockchain. This is useful
   * for view functions that don't modify the blockchain's state.
   */
  call?: boolean;

  /**
   * The private key used for signing the transaction. It should be a
   * hexadecimal string with a "0x" prefix. If not provided, the
   * transaciton will default to ALITH
   */
  privateKey?: `0x${string}`;

  /**
   * The amount of gas to use for the transaction. This can either be a
   * specific number (as a bigint) or the string "estimate", in which
   * case the library will automatically estimate the gas needed.
   */
  gas?: bigint | "estimate";

  /**
   * The native balance to send along with the transaction.
   */
  value?: bigint;

  /**
   * The JavaScript library to use for interacting with the Ethereum network.
   * "viem" or "ethers" are the currently supported options.
   */
  web3Library?: "viem" | "ethers";

  /**
   * An array of arguments to pass to the function call. The types of these
   * arguments depend on the function you're calling.
   */
  args?: any[];
}
