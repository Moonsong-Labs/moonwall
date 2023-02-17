import { describeSuite } from '../../src/cli/runner/util/runner-functions.js';
import { setTimeout } from 'timers/promises';
import { expect } from 'chai';

describeSuite({
  id: 'T100',
  title: 'New Test Suite',
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

    it('Long test', async function () {
      await setTimeout(5000)
      expect(true).to.be.true;
    });
  },
});
