import { describeSuite } from "../../src/index.js";
import { expect } from "chai";

describeSuite({
  id: "P100",
  title: "Tests that are using the production foundation",
  testCases: ({ it }) => {
    it("T01", "Passing Test", function () {
      expect(true).to.be.true;
    });

    it("T02", "Skipped test", function () {
      this.skip();
      expect(false).to.be.true;
    });
  },
});
