import { describeSuite, expect } from "@moonwall/cli";

describeSuite({
  foundationMethods: "chopsticks",
  id: "DMC01",
  title: "Test multi chopsticks",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "Verify multiple chains connected",
      test: async () => {
        const chain1Name = context
          .polkadotJs("hydration")
          .consts.system.version.specName.toString();
        const chain2Name = context.polkadotJs("assethub").consts.system.version.specName.toString();
        const chain3Name = context.polkadotJs("polkadot").consts.system.version.specName.toString();

        expect(chain1Name).toBe("hydradx");
        expect(chain2Name).toBe("statemint");
        expect(chain3Name).toBe("polkadot");
      },
    });

    it({
      id: "T02",
      title: "Verify multiple chains can increment block numbers",
      test: async () => {
        const chain1Height = (
          await context.polkadotJs("hydration").rpc.chain.getHeader()
        ).number.toNumber();
        await context.createBlock({ providerName: "hydration" });
        expect(
          (await context.polkadotJs("hydration").rpc.chain.getHeader()).number.toNumber()
        ).toBe(chain1Height + 1);

        const chain2Height = (
          await context.polkadotJs("assethub").rpc.chain.getHeader()
        ).number.toNumber();
        await context.createBlock({ providerName: "assethub" });
        expect((await context.polkadotJs("assethub").rpc.chain.getHeader()).number.toNumber()).toBe(
          chain2Height + 1
        );

        const chain3Height = (
          await context.polkadotJs("polkadot").rpc.chain.getHeader()
        ).number.toNumber();
        await context.createBlock({ providerName: "polkadot" });
        expect((await context.polkadotJs("polkadot").rpc.chain.getHeader()).number.toNumber()).toBe(
          chain3Height + 1
        );
      },
    });
  },
});
