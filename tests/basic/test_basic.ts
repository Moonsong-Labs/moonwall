import { expect } from "chai";
import { beforeAll } from "vitest";

describe("This is a timbo test suite", function () {
  beforeAll(function () {
    console.log("this is test setup");
  });

  it("This is a bool test case", function () {
    expect(true).to.be.true;
  });

  it("This is a failing number test case", function () {
    expect(1_332_323_221).to.be.lessThan(1000000);
  });

  it("This is a string test case", function () {
    expect("Home is where the bao is").to.contains("bao");
  });

  it("This is a failing error test case", function () {
    expect(() => {
      throw new Error("ERROR THROWN");
    }).to.throw("wadwada");
  });
});
