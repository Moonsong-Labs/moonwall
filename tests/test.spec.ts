import { describe, it, expect } from "vitest";
import { setTimeout } from "node:timers/promises";
import { MoonwallContext } from "../src/index.js";

describe("This is a sample test suite", async () => {
  it("this is a test case 1", ({}) => {
    expect(true).to.be.true;
  });

  it("this is a test case 2", async ({}) => {
    await setTimeout(200);
    expect(true).to.be.true;
  });
  it("this is a test case 3", async ({}) => {
    await setTimeout(1000);

    console.log(MoonwallContext.getContext().providers);
    expect(true).to.be.true;
  });
  it("this is a test case 4", async ({}) => {
    await setTimeout(500);
    expect(true).to.be.true;
  });
});
