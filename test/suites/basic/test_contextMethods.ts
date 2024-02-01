import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "B03",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: ({ it }) => {
    it({
      id: "T01",
      title: "Passing Test",
      test: () => {
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Skipped test",
      modifier: "skip",
      test: () => {
        expect(false).to.be.true;
      },
    });
  },
});
