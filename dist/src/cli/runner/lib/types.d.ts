import { ApiPromise } from "@polkadot/api";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
export declare type MoonwallConfig = {
    label: string;
    defaultTestTimeout: number;
    environments: Environment[];
};
export declare type Environment = {
    name: string;
    testFileDir: string;
    foundation: Foundation;
    include?: string[];
    connections?: ProviderConfig[];
};
export declare type Foundation = {
    type: FoundationType;
    launchSpec?: LaunchSpec[];
};
export declare type LaunchSpec = {
    bin: {
        name: string;
        path: string;
    };
    ports?: {
        p2pPort: number;
        wsPort: number;
        rpcPort: number;
    };
    alreadyRunning?: boolean;
    options?: string[];
};
export declare enum FoundationType {
    ReadOnly = "read_only",
    DevMode = "dev",
    Forked = "fork",
    ZombieNet = "zombie",
    Chopsticks = "chopsticks"
}
export interface ProviderConfig {
    name: string;
    type: ProviderType;
    endpoints: string[];
}
export declare type MoonwallEnvironment = {
    name: string;
    providers: MoonwallProvider[];
    nodes: Node[];
    context: any;
};
export interface MoonwallProvider {
    name: string;
    type: ProviderType;
    connect: () => Promise<ApiPromise> | Promise<WebSocketProvider> | Web3 | void;
    ws?: any;
}
export interface ConnectedProvider {
    name: string;
    type: ProviderType;
    api: ApiPromise | WebSocketProvider | Web3;
    disconnect: () => void;
    greet: () => Promise<void> | void;
}
export declare enum ProviderType {
    PolkadotJs,
    Ethers,
    Web3,
    Moonbeam,
    Unknown
}
export declare type Node = {
    name: string;
    type: "binary" | "chopsticks" | "zombie";
    cmd: string;
    args: string[];
};
export declare type MoonwallTestFile = {};
export declare type MoonwallTestSuite = {
    tests: MoonwallTestCase[];
};
export declare type MoonwallTestCase = {};
