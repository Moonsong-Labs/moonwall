import { testSuite } from '../src/cli/runner/util/runner-functions';
import { expect } from 'chai';

testSuite({
  id: 'P200',
  title: 'Tests that are using the production APIs',
  testCases: ({ context, it }) => {
    it('T01', 'Passing Test', async function () {
      console.log((await context.MB.query.system.account("0x1C86E56007FCBF759348dcF0479596a9857Ba105")).toHuman())
      console.log( context.MB.consts.system.version.specName.toString())
      console.log( context.DOT.consts.system.version.specName.toString())
      expect(true).to.be.true;
    });

    it('T02', 'Skipped test', function () {
      expect(true).to.be.true;
    });
  },
});
