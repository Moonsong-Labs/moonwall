import { expect, describeSuite, beforeAll } from "@moonsong-labs/moonwall-cli";

describeSuite({
  id: "B04",
  title: "This is a jimbo test suite",
  foundationMethods: "read_only",
  testCases: function ({ it }) {
    beforeAll(function () {
      console.log("this is test setup");
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
        expect(1_332_323_221).to.be.greaterThan(1000000);
      },
    });

    it({
      id: "T03",
      title: "This is a string test case",
      test: function () {
        expect("Home is where the bao is").to.contains("bao");
      },
    });

    it({
      id: "T04",
      title: "This is a error test case",
      test: function () {
        expect(() => {
          throw new Error("ERROR THROWN");
        }).to.throw("ERROR");
      },
    });
  },
});
