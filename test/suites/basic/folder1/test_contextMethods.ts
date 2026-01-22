import { describeSuite, expect } from "moonwall";

describeSuite({
  id: "B03",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: ({ it, log }) => {
    it({
      id: "T01",
      title: "Passing Test",
      test: () => {
        log("Testing context methods");
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Skipped test",
      modifier: "skip",
      test: () => {
        log("Testing skipped context method");
        expect(false).to.be.true;
      },
    });
  },
});
