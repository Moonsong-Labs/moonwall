import { ApiPromise } from "@polkadot/api";
import { Signer } from "ethers";
import { Web3 } from "web3";
import { ApiTypes } from "@polkadot/api/types/index.js";
import { ProviderType, ViemClientType, ZombieNodeType } from "./config.js";
import { Debugger } from "debug";
import { KeyringPair } from "@polkadot/keyring/types.js";
import { Account, PublicClient, Transport, WalletClient } from "viem";
import { Chain } from "viem/chains";
import { BlockCreation, BlockCreationResponse, ChopsticksBlockCreation } from "./context.js";
import { CallType } from "./foundations.js";

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
    test: () => void;
    modifier?: "only" | "skip";
    minRtVersion?: number;
    chainType?: "moonriver" | "moonbeam" | "moonbase";
    notChainType?: "moonbeam" | "moonriver" | "moonbase";
    timeout?: number;
  }): void;
}

// TODO: make chaintype/rt filters dependent on foundation type and a type itself

/**
 * @name ITestSuiteType
 * @description The test suite type.
 * @property foundationMethods - The foundation methods required for the test suite.
 * @property id - A unique identifier for the test suite.
 * @property title - The title of the test suite.
 * @property testCases - A function that receives a TestContext and defines the test cases.
 * @property options - Additional options for the test suite.
 * @property minRtVersion - The minimum runtime version required for the test suite.
 * @property chainType - The chain type required for the test suite.
 * @property notChainType - The chain type excluded from the test suite.
 */
export type ITestSuiteType =
  | {
      foundationMethods: "dev";
      id: string;
      title: string;
      testCases: (TestContext: DevTestContext) => void;
      options?: Object;
      minRtVersion?: number;
      chainType?: "moonbeam" | "moonriver" | "moonbase";
      notChainType?: "moonbeam" | "moonriver" | "moonbase";
    }
  | {
      foundationMethods: "chopsticks";
      id: string;
      title: string;
      testCases: (TestContext: ChopsticksTestContext) => void;
      options?: Object;
      minRtVersion?: number;
      chainType?: "moonbeam" | "moonriver" | "moonbase";
      notChainType?: "moonbeam" | "moonriver" | "moonbase";
    }
  | {
      foundationMethods: "zombie";
      id: string;
      title: string;
      testCases: (TestContext: ZombieTestContext) => void;
      options?: Object;
      minRtVersion?: number;
      chainType?: "moonbeam" | "moonriver" | "moonbase";
      notChainType?: "moonbeam" | "moonriver" | "moonbase";
    }
  | {
      foundationMethods: "read_only";
      id: string;
      title: string;
      testCases: (TestContext: ReadOnlyTestContext) => void;
      minRtVersion?: number;
      chainType?: "moonbeam" | "moonriver" | "moonbase";
      notChainType?: "moonbeam" | "moonriver" | "moonbase";
      options?: Object;
    }
  | {
      foundationMethods: "fork";
      id: string;
      title: string;
      testCases: (TestContext: GenericTestContext) => void;
      minRtVersion?: number;
      chainType?: "moonbeam" | "moonriver" | "moonbase";
      notChainType?: "moonbeam" | "moonriver" | "moonbase";
      options?: Object;
    };

/**
 * @name DevTestContext
 * @description The context for tests running in development mode.
 * @property context - The context for the development mode.
 * @property it - The CustomTest function for the test.
 * @property log - The Debugger instance for logging.
 */
export interface DevTestContext {
  context: DevModeContext;
  it: CustomTest;
  log: Debugger;
}

/**
 * @name ReadOnlyTestContext
 * @description The context for tests running in read-only mode.
 * @property context - The context for the read-only mode.
 * @property it - The CustomTest function for the test.
 * @property log - The Debugger instance for logging.
 */
export interface ReadOnlyTestContext {
  context: ReadOnlyContext;
  it: CustomTest;
  log: Debugger;
}

/**
 * @name ChopsticksTestContext
 * @description The context for tests running with chopsticks.
 * @property context - The context for the chopsticks mode.
 * @property it - The CustomTest function for the test.
 * @property log - The Debugger instance for logging.
 */
export interface ChopsticksTestContext {
  context: ChopsticksContext;
  it: CustomTest;
  log: Debugger;
}

/**
 * @name ZombieTestContext
 * @description The context for tests running with zombie.
 * @property context - The context for the zombie mode.
 * @property it - The CustomTest function for the test.
 * @property log - The Debugger instance for logging.
 */
export interface ZombieTestContext {
  context: ZombieContext;
  it: CustomTest;
  log: Debugger;
}

/**
 * @name GenericTestContext
 * @description The base test context for other contexts to extend, not to be used directly.
 * @property context - The base context for other contexts to extend, not to be used directly.
 * @property it - The CustomTest function for the test.
 * @property log - The Debugger instance for logging.
 */
export interface GenericTestContext {
  context: GenericContext;
  it: CustomTest;
  log: Debugger;
}

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
 * PublicViem - A PublicClient type from the 'viem' module.
 */
export type PublicViem = PublicClient<Transport, Chain, true>;

/**
 * WalletViem - A WalletClient type from the 'viem' module.
 */
export type WalletViem = WalletClient<Transport, Chain, Account, true>;

/**
 * ViemApiMap - An interface to map 'public' and 'wallet' to their respective types.
 */
export interface ViemApiMap {
  public: PublicViem;
  wallet: WalletViem;
}

/**
 * GenericContext - Interface that encapsulates all the common methods and properties needed for all tests.
 */
export interface GenericContext {
  providers: Object;
  viemClient: <T extends ViemClientType>(subType: T) => ViemApiMap[T];
  polkadotJs: (options?: { apiName?: string; type?: ProviderType }) => ApiPromise;
  ethersSigner: ([name]?: string) => Signer;
  web3: ([name]?: string) => Web3;
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
 * ZombieContext - Interface that extends from GenericContext and includes methods for upgrading runtime and waiting a certain number of blocks.
 */
export interface ZombieContext extends GenericContext {
  upgradeRuntime: (options: UpgradePreferences) => Promise<void>;
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
  createBlock: (options?: ChopsticksBlockCreation) => Promise<{ result: string }>;
  setStorage: (params: {
    providerName?: string;
    module: string;
    method: string;
    methodParams: any;
  }) => Promise<void>;
  upgradeRuntime: (context: ChopsticksContext) => Promise<void>;
}

/**
 * DevModeContext - Interface that extends from GenericContext and includes a method for creating a block.
 */
export interface DevModeContext extends GenericContext {
  createBlock<ApiType extends ApiTypes, Calls extends CallType<ApiType> | CallType<ApiType>[]>(
    transactions?: Calls,
    options?: BlockCreation
  ): Promise<BlockCreationResponse<ApiType, Calls>>;
}
