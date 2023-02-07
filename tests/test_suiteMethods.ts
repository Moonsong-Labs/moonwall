import { testSuite } from '../src/cli/runner/lib/runner-functions';
import { expect } from 'chai';

testSuite({
  id: 'T100',
  title: 'New Test Suite',
  environment: "New_Test",
  testCases: function () {
    it('Sample test', () => {
      expect(true).to.be.true;
    });

    it('Skipped test', function () {
      this.skip();
      expect(true).to.be.true;
    });

    it('Failing test', () => {
      expect(false).to.be.true;
    });
  },
});
