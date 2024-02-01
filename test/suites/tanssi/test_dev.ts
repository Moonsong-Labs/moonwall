import { beforeAll, describeSuite, expect } from "@moonwall/cli";

describeSuite({
  id: "D01",
  title: "Dev test suite",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    beforeAll(async () => {});

    it({
      id: "T01",
      title: "Checking that launched node can create blocks",
      test: async () => {
        const block = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        await context.createBlock();
        const block2 = (
          await context.polkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        log(`Previous block #${block}, new block #${block2}`);
        log("looking up account type");
        log(`This is a substrate chain: ${context.isSubstrateChain}`);
        log(`This is an ethereum chain: ${context.isEthereumChain}`);
        expect(block2).to.be.greaterThan(block);
      },
    });

    it({
      id: "T02",
      title: "Checking that default keyring is correct",
      test: async () => {
        expect(context.keyring.alice.address).toBe(
          "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        );
      },
    });
  },
});
