import { describeSuite, expect } from "@moonwall/cli";
import { setTimeout } from "node:timers/promises";

describeSuite({
  id: "B06",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: ({ it }) => {
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
      test: () => {
        expect(true).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Long test",
      test: async () => {
        await setTimeout(5000);
        expect(true).to.be.true;
      },
    });
  },
});
