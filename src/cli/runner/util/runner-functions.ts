import { MoonwallContext } from "./globalContext";
import { ApiPromise } from "@polkadot/api";
import { ConnectedProvider } from "../lib/types";
import { WebSocketProvider } from "ethers";
import Web3 from "web3";

export function newTestSuite() {
  return "Test complete!";
}

export function testSuite({ id, title, testCases }: SuiteParameters) {
  describe(`🗃️  #${id} ${title}`, function () {
    const context = {};
    MoonwallContext.getContext().providers.forEach((a: ConnectedProvider) => {
      context[a.name] = a.api;
    });

    function testCase(testcaseId: string, title: string, callback: () => void) {
      it(`📁  #${id.concat(testcaseId)} ${title}`, callback);
    }

    const polkaCtx = (name: string): ApiPromise => {
      return context[name] as ApiPromise;
    };

    testCases({ context, polkaCtx, it: testCase });
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

type TestContext = {
  context: { [name: string]: ApiPromise | WebSocketProvider | Web3 };
  polkaCtx: (string) => ApiPromise;
  it: CustomTest;
};

export async function executeRun(ctx) {
  try {
    const result = await runMochaTests();
    ctx.disconnect();
    process.exitCode = 0;
  } catch (e) {
    console.log(e);
    process.exitCode = 1;
  }
}

export const runMochaTests = () => {
  return new Promise((resolve, reject) => {
    console.log("before actual run");
    mocha.run((failures) => {
      if (failures) {
        reject("🚧  At least one test failed, check report for more details.");
      }
      resolve("🎉  Test run has completed without errors.");
    });
  });
};
