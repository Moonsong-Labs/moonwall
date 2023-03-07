import { describeSuite, expect } from "moonwall";
import { setTimeout } from "timers/promises";

describeSuite({
  id: "B06",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: function ({ it }) {
    it({
      id: "T01",
      title: "Sample test",
      test: () => {
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Skipped test",
      modifier: "skip",
      test: function () {
        expect(true).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Long test",
      test: async function () {
        await setTimeout(5000);
        expect(true).to.be.true;
      },
    });
  },
});
