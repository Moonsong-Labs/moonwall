import { ApiPromise } from "@polkadot/api";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
import { ApiTypes, AugmentedEvent, SubmittableExtrinsic } from "@polkadot/api/types/index.js";
import { BlockCreation, BlockCreationResponse } from "../lib/contextHelpers.js";
import { ProviderType } from "./config.js";

export interface CustomTest {
  (params: {
    id: string;
    title: string;
    test: () => void;
    modifier?: "only" | "skip";
    minRtVersion?: number;
    chainType?: "moonriver" | "moonbeam" | "moonbase";
    notChainType?: "moonbeam" | "moonriver" | "moonbase"
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
}

export interface ChopsticksTestContext {
  context: ChopsticksContext;
  it: CustomTest;
}

export interface GenericTestContext {
  context: GenericContext;
  it: CustomTest;
}

export interface GenericContext {
  providers: Object;
  getPolkadotJs: ([name]?: string) => ApiPromise;
  getSubstrateApi: (options?: { apiName?: string; type?: ProviderType }) => ApiPromise;
  getMoonbeam: ([name]?: string) => ApiPromise;
  getEthers: ([name]?: string) => WebSocketProvider;
  getWeb3: ([name]?: string) => Web3;
}

export interface ChopsticksContext extends GenericContext {
  createBlock: (params?: { providerName?: string; count?: number; to?: number }) => Promise<string>;
  createBlockAndCheck: (events: AugmentedEvent<ApiTypes>[]) => Promise<{ match: boolean; events: any[] }>;
  setStorage: (params: { providerName?: string; module: string; method: string; methodParams: any }) => Promise<void>;
  upgradeRuntime: (context: ChopsticksContext) => Promise<void>;
}

export interface DevModeContext extends GenericContext {
  createBlock<
    ApiType extends ApiTypes,
    Call extends SubmittableExtrinsic<ApiType> | Promise<SubmittableExtrinsic<ApiType>> | string | Promise<string>,
    Calls extends Call | Call[]
  >(
    transactions?: Calls,
    options?: BlockCreation
  ): Promise<BlockCreationResponse<ApiType, Calls extends Call[] ? Awaited<Call>[] : Awaited<Call>>>;
  createBlockAndCheck<
    ApiType extends ApiTypes,
    Call extends SubmittableExtrinsic<ApiType> | Promise<SubmittableExtrinsic<ApiType>> | string | Promise<string>,
    Calls extends Call | Call[]
  >(
    events: AugmentedEvent<ApiType>[],
    transactions?: Calls,
    options?: BlockCreation
  ): Promise<{ match: boolean; events: any[] }>;
}
