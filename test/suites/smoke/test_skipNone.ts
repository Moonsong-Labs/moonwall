import { describeSuite, expect } from "moonwall";

describeSuite({
  id: "SN00",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: ({ it, log }) => {
    it({
      id: "T01",
      title: "Passing Test",
      test: () => {
        log("Testing that true is true - basic assertion test");
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Passing test",
      test: () => {
        log("Second test - verifying boolean assertion functionality");
        expect(true).to.be.true;
      },
    });
  },
});
