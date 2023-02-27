import { describeSuite } from "../../src/index.js";
import { setTimeout } from "timers/promises";
import { expect } from "vitest";

describeSuite({
  id: "T100",
  title: "New Test Suite",
  testCases: function (it) {
    it("Sample test", () => {
      expect(true).to.be.true;
    });

    it("Skipped test", function () {
      this.skip();
      expect(true).to.be.true;
    });

    it("Failing test", () => {
      expect(false).to.be.true;
    });

    it("Long test", async function () {
      await setTimeout(5000);
      expect(true).to.be.true;
    });
  },
});
