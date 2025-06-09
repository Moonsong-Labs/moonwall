import { expect, describeSuite, beforeAll } from "@moonwall/cli";
import { setupLogger } from "@moonwall/util";

describeSuite({
  id: "B02",
  title: "This is a timbo test suite",
  foundationMethods: "read_only",
  testCases: ({ it, log }) => {
    const anotherLogger = setupLogger("additional");

    beforeAll(() => {
      log("Test suite setup");
    });

    it({
      id: "T01",
      title: "This is a bool test case",
      test: () => {
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "This is a number test case",
      test: () => {
        anotherLogger.info("Test case log");
        expect(1_332_323_221).to.be.greaterThan(1000000);
      },
    });

    it({
      id: "T03",
      title: "This is a string test case",
      test: () => {
        expect("Home is where the heart is").to.contains("heart");
      },
    });

    it({
      id: "T04",
      title: "This is a failing error test case",
      test: () => {
        expect(() => {
          throw new Error("ERROR THROWN");
        }).to.throw("ERROR THROWN");
      },
    });
  },
});
