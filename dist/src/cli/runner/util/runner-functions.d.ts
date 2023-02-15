import { ApiPromise } from "@polkadot/api";
import { FoundationType } from "../lib/types";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
export declare function testSuite({ id, title, testCases, supportedFoundations, }: SuiteParameters): void;
interface CustomTest {
    (id: string, title: string, cb: () => void, only?: boolean): void;
}
interface SuiteParameters {
    id: string;
    title: string;
    environment?: string;
    testCases: (TestContext: TestContext) => void;
    options?: Object;
    supportedFoundations?: FoundationType[];
}
interface TestContext {
    context: Subcontext;
    it: CustomTest;
}
interface Subcontext {
    providers: Object;
    getPolkadotJs: ([name]?: string) => ApiPromise;
    getMoonbeam: ([name]?: string) => ApiPromise;
    getEthers: ([name]?: string) => WebSocketProvider;
    getWeb3: ([name]?: string) => Web3;
}
export {};
