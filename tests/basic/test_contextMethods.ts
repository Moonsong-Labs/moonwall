import { describeSuite, expect } from "@moonsong-labs/moonwall-cli";

describeSuite({
  id: "B03",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: ({ it }) => {
    it({
      id: "T01",
      title: "Passing Test",
      test: function () {
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Skipped test",
      modifier: "skip",
      test: function () {
        expect(false).to.be.true;
      },
    });
  },
});
