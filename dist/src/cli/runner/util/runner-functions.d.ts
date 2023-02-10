import { ApiPromise } from "@polkadot/api";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";
export declare function testSuite({ id, title, testCases }: SuiteParameters): void;
interface CustomTest {
    (id: string, title: string, cb: () => void, only?: boolean): void;
}
interface SuiteParameters {
    id: string;
    title: string;
    environment?: string;
    testCases: (TestContext: TestContext) => void;
    options?: Object;
}
interface TestContext {
    context: Subcontext;
    it: CustomTest;
}
interface Subcontext {
    providers: Object;
    polkaCtx: ([name]: string) => ApiPromise;
    ethersApi: ([name]: string) => WebSocketProvider;
    web3Api: ([name]: string) => Web3;
}
export {};
