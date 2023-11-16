import { expect, describeSuite, beforeAll } from "@moonwall/cli";
import { setupLogger } from "@moonwall/util";

describeSuite({
  id: "B02",
  title: "This is a timbo test suite",
  foundationMethods: "read_only",
  testCases: function ({ it, log }) {
    const anotherLogger = setupLogger("additional");

    beforeAll(function () {
      log("Test suite setup");
    });

    it({
      id: "T01",
      title: "This is a bool test case",
      test: function () {
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "This is a number test case",
      test: function () {
        anotherLogger("Test case log");
        expect(1_332_323_221).to.be.greaterThan(1000000);
      },
    });

    it({
      id: "T03",
      title: "This is a string test case",
      test: function () {
        expect("Home is where the heart is").to.contains("heart");
      },
    });

    it({
      id: "T04",
      title: "This is a failing error test case",
      test: function () {
        expect(() => {
          throw new Error("ERROR THROWN");
        }).to.throw("ERROR THROWN");
      },
    });

    it({
      id: "T05",
      title: "This test case can read globals",
      test: function () {
        log("Printing Global config", globalThis.config);
        expect(globalThis.config).to.be.an("object");
      },
    });
  },
});
