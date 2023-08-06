import "@moonbeam-network/api-augment";
import { describeSuite, expect, beforeAll, beforeEach } from "@moonwall/cli";
import { CHARLETH_ADDRESS, ETHAN_ADDRESS, alith } from "@moonwall/util";
import { parseEther } from "ethers";
import { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "D01",
  title: "Dev test suite",
  foundationMethods: "dev",
  testCases: ({ it, context }) => {
    // let api: ApiPromise;
    const DUMMY_ACCOUNT = "0x11d88f59425cbc1867883fcf93614bf70e87E854";

    beforeAll(() => {
      // api = context.polkadotJs();
    });

    it({
      id: "E01",
      title: "Balance starts at 0",
      test: async function () {
        const balanceBefore = (await context.polkadotJs().query.system.account(DUMMY_ACCOUNT)).data
          .free;
        expect(balanceBefore.toString()).toEqual("0");

        await context
          .polkadotJs()
          .tx.balances.transfer(DUMMY_ACCOUNT, parseEther("1"))
          .signAndSend(alith);
        await context.createBlock();
        const balanceAfter = (await context.polkadotJs().query.system.account(DUMMY_ACCOUNT)).data
          .free;
        expect(balanceAfter.sub(balanceBefore).toString()).toEqual(parseEther("1").toString());
      },
    });

    it({
      id: "E02",
      title: "State is kept between tests",
      test: async function () {
        const balanceBefore = (await context.polkadotJs().query.system.account(DUMMY_ACCOUNT)).data
          .free;
        expect(balanceBefore.toString()).toEqual(parseEther("1").toString());
        await context
          .polkadotJs()
          .tx.balances.transfer(DUMMY_ACCOUNT, parseEther("1"))
          .signAndSend(alith);
        await context.createBlock();
        const balanceAfter = (await context.polkadotJs().query.system.account(DUMMY_ACCOUNT)).data
          .free;
        expect(balanceAfter.sub(balanceBefore).toString()).toEqual(parseEther("1").toString());
      },
    });
  },
});
