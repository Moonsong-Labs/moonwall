import { describeSuite, expect } from "moonwall";
import { setTimeout } from "node:timers/promises";

describeSuite({
  id: "B06",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: ({ it, log }) => {
    it({
      id: "T01",
      title: "Sample test",
      test: () => {
        log("Sample test - verifying basic assertion works");
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Skipped test",
      modifier: "skip",
      test: () => {
        log("This test is skipped - should not execute");
        expect(true).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Long test",
      test: async () => {
        log("Starting long test - will wait 5 seconds");
        await setTimeout(5000);
        log("Completed 5 second wait - asserting true");
        expect(true).to.be.true;
      },
    });
  },
});
