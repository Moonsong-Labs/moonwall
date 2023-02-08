import { runMochaTests } from './mocha-setup';
import { defineTestSuiteAndAddTests } from '../../../../../tests/sample/test_sample';

(async () => {
  defineTestSuiteAndAddTests();

  try {
    const result = await runMochaTests();
    console.log(result);
  } catch (e) {
    console.log(e);
  }
})();

export async function executeRun(suiteCallBacks) {
  suiteCallBacks.forEach((fn) => fn());

  try {
    const result = await runMochaTests();
    console.log(result);
  } catch (e) {
    console.log(e);
  }
}
