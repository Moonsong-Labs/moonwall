import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "SM00",
  title: "New Test Suite",
  foundationMethods: "read_only",
  testCases: ({ it, log }) => {
    it({
      id: "T01",
      title: "Skipped Test",
      test: () => {
        log("Testing smoke test skip behavior - expecting false to be true");
        expect(false).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Passing test",
      test: () => {
        log("Testing smoke test passing case");
        expect(true).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Skipped test",
      test: () => {
        log("Testing another smoke test skip scenario");
        expect(false).to.be.true;
      },
    });
  },
});
