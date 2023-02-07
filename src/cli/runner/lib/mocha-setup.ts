import Mocha from 'mocha';
import path from 'path';

export const Test = Mocha.Test;

export const suiteInstance = Mocha.Suite;

const mocha = new Mocha({
  timeout: 2000000,
  reporter: 'list',
});

export const suite = (suiteName: string) => suiteInstance.create(mocha.suite, suiteName);

export const runMochaTests = () => {
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures) {
        reject('❌  At least one test failed, check report for more details.');
      }

      resolve('🎉  Test run has completed without errors.');
    });
  });
};
