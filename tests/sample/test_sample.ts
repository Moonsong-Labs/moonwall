import { suite, Test, suiteInstance } from '../../src/cli/runner/lib/mocha-setup';
import { expect } from 'chai';

export const defineTestSuiteAndAddTests = () => {
  const parentSuite = suite('timbo test');
  testSuiteAboutNumber(parentSuite)
  testSuiteAboutParent(parentSuite)
  testSuiteAboutStrings(parentSuite)
};

const testSuiteAboutNumber = (parentSuite) => {
  const testSuite = suiteInstance.create(parentSuite, 'Comparison with the number 10');
  Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]).forEach((a) => {
    testSuite.addTest(
      new Test(`Validate ${a} is not equal to 10`, function () {
        expect(a).to.not.equals(10);
      })
    );
  });
};

const testSuiteAboutStrings = (parentSuite) => {
    const testSuite = suiteInstance.create(parentSuite, "Validate a specific word's presents")
    testSuite.addTest(new Test("Validate 'bao' is present in the 'home is where the bao is", function (){
        expect("home is where the bao is").contains("bao")
    }))
}

const testSuiteAboutParent = (parentSuite) => {
    parentSuite.addTest(new Test(`Validate number is less than 11`, function (){
        const number = 10
        expect(number).to.be.lessThan(11)
    }))
}