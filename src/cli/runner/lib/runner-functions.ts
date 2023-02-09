// import { MoonwallContext } from './globalContext';

export function newTestSuite() {
  return 'Test complete!';
}



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

type TestContext = {
  context: Object;
  it: CustomTest;
};

class TestCase {
  constructor() {}
}
