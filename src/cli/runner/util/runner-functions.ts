import { MoonwallContext } from "./globalContext";
import { ApiPromise } from "@polkadot/api";
import { ConnectedProvider } from "../lib/types";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";

export function testSuite({ id, title, testCases }: SuiteParameters) {
  describe(`🗃️  #${id} ${title}`, function () {
    let context = {
      providers: {},
      polkaCtx: (apiName: string): ApiPromise =>
        context.providers[apiName] ,
      ethersApi: (apiName: string): WebSocketProvider =>
        context.providers[apiName] ,
      web3Api: (apiName: string): Web3 => context.providers[apiName],
    };

    MoonwallContext.getContext().providers.forEach((a: ConnectedProvider) => {
      context.providers[a.name] = a.api;
    });

    function testCase(testcaseId: string, title: string, callback: () => void) {
      it(`📁  #${id.concat(testcaseId)} ${title}`, callback);
    }

    testCases({ context, it: testCase });
  });
}

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