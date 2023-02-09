import {  printStats } from '../../src/cli/runner/lib/globalContext';
import { testSuite } from '../../src/cli/runner/lib/runner-functions';
import { expect } from 'chai';



// testSuite({
//   id: 'P200',
//   title: 'Tests that are using the production APIs',
//   testCases: ({ context, it }) => {
//     it('T01', 'Passing Test', function () {
//       printStats()
//       expect(true).to.be.true;
//     });

//     it('T02', 'Skipped test', function () {
//       expect(true).to.be.true;
//     });
//   },
// });

describe("test", ()=>{
  it("test case", ()=>{

        printStats()
    expect(true).to.be.true
  })
})