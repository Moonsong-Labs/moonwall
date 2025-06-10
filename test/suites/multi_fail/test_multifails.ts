import { expect, describeSuite, beforeAll } from "@moonwall/cli";
import { setupLogger } from "@moonwall/util";
import { setTimeout } from "timers/promises";
describeSuite({
  id: "F01",
  title: "This test suite fails multiple times",
  foundationMethods: "read_only",
  testCases: ({ it, log }) => {
    const anotherLogger = setupLogger("additional");

    beforeAll(() => {
      log("Test suite setup");
    });

    it({
      id: "T01",
      title: "This is a bool test case",
      test: async () => {
        log("Testing intentional failure case T01");
        await setTimeout(500);
        expect(false).to.be.true;
      },
    });
    it({
      id: "T02",
      title: "This is a bool test case",
      test: async () => {
        const rand = Math.floor(Math.random() * 1000);
        log(`Testing random number ${rand} > 800`);
        expect(rand).toBeGreaterThan(800);
      },
    });
    it({
      id: "T03",
      title: "This is a bool test case",
      test: async () => {
        log("Testing intentional failure case T03");
        await setTimeout(500);
        expect(false).to.be.true;
      },
    });
    it({
      id: "T04",
      title: "This is a bool test case",
      test: async () => {
        log("Testing intentional failure case T04");
        await setTimeout(500);
        expect(false).to.be.true;
      },
    });
    it({
      id: "T05",
      title: "This is a bool test case",
      test: async () => {
        log("Testing intentional failure case T05");
        await setTimeout(500);
        expect(false).to.be.true;
      },
    });
  },
});
