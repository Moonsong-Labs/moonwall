import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "SO00",
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
      test: () => {
        expect(false).to.be.true;
      },
    });
  },
});
