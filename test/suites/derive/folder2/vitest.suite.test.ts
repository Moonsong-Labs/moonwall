import { describe, beforeAll, it, expect } from "vitest";

describe("basic", () => {
  beforeAll(() => {
    console.log("running this before tests");
  });

  it("should run", () => {
    expect(true).toBe(true);
  });

  it("should run", () => {
    expect(3 > 2).toBe(true);
  });
  it("should run", () => {
    expect("true".length).toBeGreaterThan(0);
  });
});
