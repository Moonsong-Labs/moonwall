import "@moonbeam-network/api-augment";
import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import type { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "F01",
  title: "Fork test",
  foundationMethods: "dev",
  options: {
    forkConfig: {
      endpoint: "https://moonbeam.public.blastapi.io",
      block: 100,
    },
  },
  testCases: ({ it, context }) => {
    let polkadotJs: ApiPromise;

    beforeAll(() => {
      polkadotJs = context.polkadotJs();
    });

    it({
      id: "T01",
      title: "Checking that launched node can create blocks",
      test: async () => {
        const block = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        await context.createBlock();
        const block2 = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        expect(block2).to.be.greaterThan(block);
      },
    });
  },
});
