import { ApiPromise } from "@polkadot/api";

export type MoonwallConfig = {
    defaultTestTimeout: number,
    environments: Environment[]
};

export type Environment = {
    name: string,
    testFileDir: string,
    foundation: Foundation,
    connections: ProviderConfig[]
}
export interface LaunchedNode {

}

export type Foundation = {
    type: "production" | "dev" | "fork" | "zombie" | "chopsticks"
}

export interface ConnectedProvider{
    name: string,
    api: ApiPromise ,
    disconnect: ()=>void,
    greet: () => void
}

export interface ProviderConfig {
    name: string,
    type: "polkadotJs" | "ethers" | "web3" | "moonbeam",
    endpoints: string[],
    connect(): ()=> void
}

export interface MoonwallProvider {
    name: string,
    connect: () => Promise<ApiPromise>,
}


export type MoonwallTestFile = {};

export type MoonwallTestSuite = {
  tests: MoonwallTestCase[];
};

export type MoonwallTestCase = {};


export type MoonwallEnvironment = {
    name: string;
    providers: MoonwallProvider[]
    context: any;
  };
  