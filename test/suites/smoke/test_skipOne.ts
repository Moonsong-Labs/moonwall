import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "SO00",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: ({ it, log }) => {
    it({
      id: "T01",
      title: "Passing Test",
      test: () => {
        log("First test in skip suite - verifying basic functionality");
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Skipped test",
      test: () => {
        log("This test should fail - testing false assertion");
        expect(false).to.be.true;
      },
    });
  },
});
