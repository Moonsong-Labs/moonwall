import { ApiPromise } from "@polkadot/api";
import { Foundation, ProviderType } from "./configAndContext.js";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
import { ApiTypes, AugmentedEvent, SubmittableExtrinsic } from "@polkadot/api/types/index.js";
import { BlockCreation, BlockCreationResponse } from "../utils/contextHelpers.js";

export interface CustomTest {
    (params: {
      id: string;
      title: string;
      test: () => void;
      modifier?: "only" | "skip";
      timeout?: number;
    }): void;
  }
  
  export type TestSuiteType<TFoundation = Foundation> =
    TFoundation extends Foundation.Dev
      ? {
          id: string;
          title: string;
          testCases: (TestContext: DevTestContext) => void;
          options?: Object;
          foundationMethods?: TFoundation;
        }
      : TFoundation extends Foundation.Chopsticks
      ? {
          id: string;
          title: string;
          testCases: (TestContext: ChopsticksTestContext) => void;
          options?: Object;
          foundationMethods?: TFoundation;
        }
      : {
          id: string;
          title: string;
          testCases: (TestContext: GenericTestContext) => void;
          options?: Object;
          foundationMethods?: TFoundation;
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
    getSubstrateApi: (options?: {
      apiName?: string;
      type?: ProviderType;
    }) => ApiPromise;
    getMoonbeam: ([name]?: string) => ApiPromise;
    getEthers: ([name]?: string) => WebSocketProvider;
    getWeb3: ([name]?: string) => Web3;
  }
  
  export interface ChopsticksContext extends GenericContext {
    createBlock: (params?: {
      providerName?: string;
      count?: number;
      to?: number;
    }) => Promise<string>;
    createBlockAndCheck: (
      events: AugmentedEvent<ApiTypes>[]
    ) => Promise<{ match: boolean; events: any[] }>;
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
      BlockCreationResponse<
        ApiType,
        Calls extends Call[] ? Awaited<Call>[] : Awaited<Call>
      >
    >;
    createBlockAndCheck<
      ApiType extends ApiTypes,
      Call extends
        | SubmittableExtrinsic<ApiType>
        | Promise<SubmittableExtrinsic<ApiType>>
        | string
        | Promise<string>,
      Calls extends Call | Call[]
    >(
      events: AugmentedEvent<ApiType>[],
      transactions?: Calls,
      options?: BlockCreation
    ): Promise<{ match: boolean; events: any[] }>;
  }
  