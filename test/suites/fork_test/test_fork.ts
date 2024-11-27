import "@moonbeam-network/api-augment";
import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import type { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "F01",
  title: "Fork test",
  foundationMethods: "dev",
  options: {
    forkConfig: {
      url: "https://moonbeam.public.blastapi.io",
      verbose: true
    },
  },
  testCases: ({ it, context , log}) => {
    let polkadotJs: ApiPromise;

    beforeAll(async () => {
      polkadotJs = context.polkadotJs();
      log("Waiting a minute for lazy loading to do its thing");
      await new Promise((resolve) => setTimeout(resolve, 60_000)); // wait for  LL loading 1 minute
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
