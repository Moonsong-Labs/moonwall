import { TestFunction } from 'mocha';

export function newTestSuite() {
  return 'Test complete!';
}

export const runMochaTests = (Mocha: Mocha) => {
  return new Promise((resolve, reject) => {
    Mocha.run((failures) => {
      if (failures) {
        reject('🚧  At least one test failed, check report for more details.');
      }

      resolve('🎉  Test run has completed without errors.');
    });
  });
};

export function testSuite({ id, title, testCases, environment }: SuiteParameters) {
  describe(`🗃️  #${id} ${title}`, function () {
    let context = {};

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
  environment: string;
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
