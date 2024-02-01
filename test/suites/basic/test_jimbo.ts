import { expect, describeSuite, beforeAll } from "@moonwall/cli";

describeSuite({
  id: "B04",
  title: "This is a jimbo test suite",
  foundationMethods: "read_only",
  testCases: ({ it, log }) => {
    beforeAll(() => {
      log("this is test setup");
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
        expect(1_332_323_221).to.be.greaterThan(1000000);
      },
    });

    it({
      id: "T03",
      title: "This is a string test case",
      test: () => {
        expect("Home is where the bao is").to.contains("bao");
      },
    });

    it({
      id: "T04",
      title: "This is a error test case",
      test: () => {
        expect(() => {
          throw new Error("ERROR THROWN");
        }).to.throw("ERROR");
      },
    });
  },
});
