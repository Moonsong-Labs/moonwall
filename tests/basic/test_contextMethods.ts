import { testSuite } from '../../src/cli/runner/util/runner-functions.js';
import { expect } from 'chai';

testSuite({
  id: 'T100',
  title: 'New Test Suite',
  environment: "New_Test",
  testCases: ({ it }) => {
    it('T01', 'Passing Test', function () {
      expect(true).to.be.true;
    });

    it('T02', 'Skipped test', function () {
      this.skip()
      expect(false).to.be.true;
    });
  },
});
