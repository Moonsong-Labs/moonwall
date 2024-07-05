import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "SM00",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: ({ it }) => {
    it({
      id: "T01",
      title: "Skipped Test",
      test: () => {
        expect(false).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Passing test",
      test: () => {
        expect(true).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Skipped test",
      test: () => {
        expect(false).to.be.true;
      },
    });
  },
});
