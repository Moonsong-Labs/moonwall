import { ApiPromise } from "@polkadot/api";
import { Signer } from "ethers";
import {Web3} from "web3";
import { ApiTypes, AugmentedEvent, SubmittableExtrinsic } from "@polkadot/api/types/index.js";
import { BlockCreation, BlockCreationResponse, ChopsticksBlockCreation } from "../lib/contextHelpers.js";
import { ProviderType } from "./config.js";
import { Debugger } from "debug";

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
      id: string;
      title: string;
      testCases: (TestContext: DevTestContext) => void;
      options?: Object;
      minRtVersion?: number;
      chainType?: "moonbeam" | "moonriver" | "moonbase";
      notChainType?: "moonbeam" | "moonriver" | "moonbase";
      foundationMethods: "dev";
    }
  | {
      id: string;
      title: string;
      testCases: (TestContext: ChopsticksTestContext) => void;
      options?: Object;
      minRtVersion?: number;
      chainType?: "moonbeam" | "moonriver" | "moonbase";
      notChainType?: "moonbeam" | "moonriver" | "moonbase";
      foundationMethods: "chopsticks";
    }
  | {
      id: string;
      title: string;
      testCases: (TestContext: GenericTestContext) => void;
      minRtVersion?: number;
      chainType?: "moonbeam" | "moonriver" | "moonbase";
      notChainType?: "moonbeam" | "moonriver" | "moonbase";
      options?: Object;
      foundationMethods: "read_only" | "fork" | "zombie";
    };

export interface DevTestContext {
  context: DevModeContext;
  it: CustomTest;
  log: Debugger;
}

export interface ChopsticksTestContext {
  context: ChopsticksContext;
  it: CustomTest;
  log: Debugger;
}

export interface GenericTestContext {
  context: GenericContext;
  it: CustomTest;
  log: Debugger;
}

export interface GenericContext {
  providers: Object;
  getSubstrateApi: (options?: { apiName?: string; type?: ProviderType }) => ApiPromise;
  ethersSigner: ([name]?: string) => Signer;
  web3: ([name]?: string) => Web3;
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
