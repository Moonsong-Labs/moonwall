import { TestFunction } from 'mocha';
import { MoonwallContext } from './globalContext';

export function newTestSuite() {
  return 'Test complete!';
}

export async function executeRun(ctx: MoonwallContext, mocha: Mocha) {
  try {
    const result = await runMochaTests(mocha);
    console.log(result);
    ctx.disconnect();
    process.exitCode = 0;
  } catch (e) {
    console.log(e);
    process.exitCode = 1;
  }
}

export const runMochaTests = (mocha: Mocha) => {
  // const mocha = MoonwallContext.getContext().mocha
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures) {
        reject('🚧  At least one test failed, check report for more details.');
      }
      resolve('🎉  Test run has completed without errors.');
    });
  });
};

export function testSuite({ id, title, testCases }: SuiteParameters) {
  describe(`🗃️  #${id} ${title}`, function () {
    const context = {};
    // MoonwallContext.getContext().providers.forEach((a) => {
    //   context[a.name] = a.api;
    // });
    // console.log(MoonwallContext.getContext())

    function testCase(id: string, title: string, callback: () => void) {
      it(`📁  #${id.concat(id)} ${title}`, callback);
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

interface TestCase extends TestFunction {}

type TestContext = {
  context: Object;
  it: CustomTest;
};

class TestCase {
  constructor() {}
}
