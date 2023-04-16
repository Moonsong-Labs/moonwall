import { ApiPromise } from "@polkadot/api";
import { Signer } from "ethers";
import { Web3 } from "web3";
import { ApiTypes, AugmentedEvent, SubmittableExtrinsic } from "@polkadot/api/types/index.js";
import {
  BlockCreation,
  BlockCreationResponse,
  ChopsticksBlockCreation,
} from "../lib/contextHelpers.js";
import { ProviderType, ZombieNodeType } from "./config.js";
import { Debugger } from "debug";
import { KeyringPair } from "@polkadot/keyring/types.js";

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

export interface DevTestContext {
  context: DevModeContext;
  it: CustomTest;
  log: Debugger;
}

export interface ReadOnlyTestContext {
  context: ReadOnlyContext;
  it: CustomTest;
  log: Debugger;
}

export interface ChopsticksTestContext {
  context: ChopsticksContext;
  it: CustomTest;
  log: Debugger;
}

export interface ZombieTestContext {
  context: ZombieContext;
  it: CustomTest;
  log: Debugger;
}

export interface GenericTestContext {
  context: GenericContext;
  it: CustomTest;
  log: Debugger;
}

export interface UpgradePreferences {
  runtimeName?: "moonbase" | "moonriver" | "moonbeam";
  runtimeTag?: "local" | string;
  from?: KeyringPair;
  waitMigration?: boolean;
  useGovernance?: boolean;
  localPath?: string;
  logger?: Debugger;
}

export interface GenericContext {
  providers: Object;
  polkadotJs: (options?: { apiName?: string; type?: ProviderType }) => ApiPromise;
  ethersSigner: ([name]?: string) => Signer;
  web3: ([name]?: string) => Web3;
}

export interface ReadOnlyContext extends GenericContext {
  waitBlock: (blocksToWaitFor?: number,chain?: string) => Promise<void>;
}

export interface ZombieContext extends GenericContext {
  upgradeRuntime: (options: UpgradePreferences) => Promise<void>;
  waitBlock: (blocksToWaitFor?: number, chain?: ZombieNodeType) => Promise<void>;
}

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

export interface DevModeContext extends GenericContext {
  createBlock<
    ApiType extends ApiTypes,
    Call extends
      | SubmittableExtrinsic<ApiType>
      | Promise<SubmittableExtrinsic<ApiType>>
      | string
      | Promise<string>,
    Calls extends Call | Call[]
  >(
    transactions?: Calls,
    options?: BlockCreation
  ): Promise<
    BlockCreationResponse<ApiType, Calls extends Call[] ? Awaited<Call>[] : Awaited<Call>>
  >;
}
