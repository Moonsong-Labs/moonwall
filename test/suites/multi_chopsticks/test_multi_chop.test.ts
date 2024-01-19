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
        const chain1Name = context.polkadotJs("hydradx").consts.system.version.specName.toString();
        const chain2Name = context
          .polkadotJs("zeitgeist")
          .consts.system.version.specName.toString();
        const chain3Name = context.polkadotJs("polkadot").consts.system.version.specName.toString();

        expect(chain1Name).toBe("hydradx");
        expect(chain2Name).toBe("zeitgeist");
        expect(chain3Name).toBe("polkadot");
      },
    });

    it({
      id: "T02",
      title: "Verify multiple chains can increment block numbers",
      test: async () => {
        const chain1Height = (
          await context.polkadotJs("hydradx").rpc.chain.getHeader()
        ).number.toNumber();
        await context.createBlock({ providerName: "hydradx" });
        expect((await context.polkadotJs("hydradx").rpc.chain.getHeader()).number.toNumber()).toBe(
          chain1Height + 1
        );

        const chain2Height = (
          await context.polkadotJs("zeitgeist").rpc.chain.getHeader()
        ).number.toNumber();
        await context.createBlock({ providerName: "zeitgeist" });
        expect((await context.polkadotJs("zeitgeist").rpc.chain.getHeader()).number.toNumber()).toBe(
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


    it({
      id: "T03",
      title: "Verify it can upgrade in multichain setup",
      modifier:"skip",
      test: async () => {
        const specVersion = context.polkadotJs("hydradx").consts.system.version.specVersion.toNumber();
        await context.upgradeRuntime("hydradx");
        // log((await context.polkadotJs("hydradx").query.system.account(context.keyring.alice.address)).toHuman());
        expect(context.polkadotJs("hydradx").consts.system.version.specVersion.toNumber()).toBeGreaterThan(
          specVersion
        );
      },
    });


  },
});
