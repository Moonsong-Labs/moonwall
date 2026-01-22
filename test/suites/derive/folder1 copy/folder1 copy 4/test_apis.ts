import { beforeAll, describeSuite, expect } from "moonwall";

describeSuite({
  id: "D010201",
  title: "Tests that are using the production APIs",
  foundationMethods: "read_only",
  testCases: ({ context, it }) => {
    it({
      id: "T01",
      title: "Passing Test",
      test: async () => {
        expect(true).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "another passing test",
      test: () => {
        expect("true").to.contain("true");
      },
    });
  },
});
