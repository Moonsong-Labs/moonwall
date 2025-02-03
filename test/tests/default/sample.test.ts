import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "B01",
  title: "Tests that are using the production APIs",
  foundationMethods: "dev",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "Passing Test",
      test: async () => {
        expect(true).to.be.true;
      },
    });

  },
});
