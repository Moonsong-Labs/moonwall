import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import { alith } from "@moonwall/util";
import { parseEther } from "ethers";
import { ApiPromise } from "@polkadot/api";
import "@polkadot/api-augment";

describeSuite({
  id: "D41",
  title: "Dev test suite 2",
  foundationMethods: "dev",
  testCases: ({ it, context }) => {
    let api: ApiPromise;
    const DUMMY_ACCOUNT = "0x11d88f59425cbc1867883fcf93614bf70e87E854";

    beforeAll(() => {
      api = context.polkadotJs();
    });

    it({
      id: "E01",
      title: "Balance starts at 0",
      test: async () => {
        const balanceBefore = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
        expect(balanceBefore.toString()).toEqual("0");

        await api.tx.balances.transferAllowDeath(DUMMY_ACCOUNT, parseEther("1")).signAndSend(alith);
        await context.createBlock();
        const balanceAfter = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
        expect(balanceAfter.sub(balanceBefore).toString()).toEqual(parseEther("1").toString());
      },
    });

    it({
      id: "E02",
      title: "State kept between tests",
      test: async () => {
        const balanceBefore = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
        expect(balanceBefore.toString()).toEqual(parseEther("1").toString());

        await api.tx.balances.transferAllowDeath(DUMMY_ACCOUNT, parseEther("1")).signAndSend(alith);
        await context.createBlock();
        const balanceAfter = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
        expect(balanceAfter.sub(balanceBefore).toString()).toEqual(parseEther("1").toString());
      },
    });
  },
});
