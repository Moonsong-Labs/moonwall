import { expect, describeSuite, beforeAll } from "moonwall";

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
        log("Testing boolean assertion in jimbo suite");
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "This is a number test case",
      test: () => {
        log("Testing number comparison: 1,332,323,221 > 1,000,000");
        expect(1_332_323_221).to.be.greaterThan(1000000);
      },
    });

    it({
      id: "T03",
      title: "This is a string test case",
      test: () => {
        log("Testing string contains: 'Home is where the bao is' contains 'bao'");
        expect("Home is where the bao is").to.contains("bao");
      },
    });

    it({
      id: "T04",
      title: "This is a error test case",
      test: () => {
        log("Testing error throwing with partial message match");
        expect(() => {
          throw new Error("ERROR THROWN");
        }).to.throw("ERROR");
      },
    });
  },
});
