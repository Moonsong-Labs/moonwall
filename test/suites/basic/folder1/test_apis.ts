import { beforeAll, describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "B01",
  title: "Tests that are using the production APIs",
  foundationMethods: "read_only",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "Passing Test",
      test: async () => {
        log("Testing API production connection");
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "another passing test",
      test: () => {
        log("Testing string contains with API context");
        expect("true").to.contain("true");
      },
    });
  },
});
