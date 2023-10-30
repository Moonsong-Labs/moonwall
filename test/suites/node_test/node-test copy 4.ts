import { before, describe, it } from "node:test";
import { expect } from "chai";
import { setTimeout as timer } from "timers/promises";

describe("B02" + "This is a timbo test suite", () => {
  before(function () {
    console.log("Test suite setup");
  });

  it("T01" + "This is a bool test case", function () {
    expect(true).to.be.true;
  });

  it("T02" + "This is a number test case", function () {
    console.log("Test case log");
    expect(1_332_323_221).to.be.greaterThan(1000000);
  });

  it("T03" + "This is a string test case", async function () {
    await timer(100)
    expect("Home is where the heart is").to.contains("heart");
  });

  it("T04" + "This is a failing error test case", function () {
    expect(() => {
      throw new Error("ERROR THROWN");
    }).to.throw("ERROR THROWN");
  });
});
