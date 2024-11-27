import "@moonbeam-network/api-augment";
import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import type { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "F01",
  title: "Fork test",
  foundationMethods: "dev",
  options: {
    forkConfig: {
      url: "https://moonbeam.unitedbloc.com",
      verbose: true,
      blockHash: "0xffe39256c17cc4523a07c907bcf1aeeef4db217cd57cfcfb95d56088e0bb9f2d"
    },
  },
  testCases: ({ it, context, log }) => {
    let polkadotJs: ApiPromise;

    beforeAll(async () => {
      polkadotJs = context.polkadotJs();
    });

    it({
      id: "T01",
      title: "Checking that launched node can create blocks",
      test: async () => {
        const block = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        await context.createBlock([], { finalize: false });
        const block2 = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        expect(block2).to.be.greaterThan(block);
      },
    });

    it({
      id: "T02",
      title: "Check that state overrides work",
      test: async () => {
        const testAccount = "0x8300db2442725604b8f5Eb172692Bb15078205c2";
        log(`Address: ${testAccount}`);

        const {
          data: { free },
        } = await polkadotJs.query.system.account(testAccount);
        expect(free.toBigInt(), "Free balance should be 1337000").toBe(1337000000000000000000n);
      },
    });

    it({
      id: "T03",
      title: "Check that forking works at a particular height",
      test: async () => {
        const testAccount = "0x0f300B667c55B28f4609EecE5628Cc27445A10cC";
        log(`Address: ${testAccount}`);

        const {
          data: { free },
        } = await polkadotJs.query.system.account(testAccount);
        expect(free.toBigInt(), `Free balance should match what account ${testAccount} has at block #8508372`).toBe(76562560590695097485140n);
      },
    });
  },
});
