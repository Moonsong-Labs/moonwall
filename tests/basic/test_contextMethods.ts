import { expect } from 'chai';
import { describeSuite } from '../../src/index.js';

describeSuite({
  id: 'T100',
  title: 'New Test Suite',
  testCases: ({ it }) => {
    it('T01', 'Passing Test', function () {
      expect(true).to.be.true;
    });

    it('T02', 'Skipped test', function () {
      this.skip();
      expect(false).to.be.true;
    });
  }
});
