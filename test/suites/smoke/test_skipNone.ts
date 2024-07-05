import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "SN00",
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
      title: "Passing test",
      test: () => {
        expect(true).to.be.true;
      },
    });
  },
});
