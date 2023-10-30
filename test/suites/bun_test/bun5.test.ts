import { beforeAll,expect, describe, test } from "bun:test";
import { setTimeout as timer } from "timers/promises";

describe("B02" + "This is a timbo test suite", () => {
  beforeAll(function () {
    console.log("Test suite setup");
  });

  test("T01" + "This is a bool test case", function () {
    expect(true).toBe(true);
  });

  test("T02" + "This is a number test case", function () {
    console.log("Test case log");
    expect(1_332_323_221).toBeGreaterThan(1000000);
  });

  test("T03" + "This is a string test case", async function () {
    await timer(100)
    expect("Home is where the heart is").toContain("heart");
  });

  test("T04" + "This is a failing error test case", function () {
    expect(() => {
      throw new Error("ERROR THROWN");
    }).toThrow("ERROR THROWN");
  });
});
