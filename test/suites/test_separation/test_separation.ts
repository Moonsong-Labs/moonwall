import "@moonbeam-network/api-augment";
import { describeSuite, expect } from "@moonwall/cli";
import { alith } from "@moonwall/util";
import { parseEther } from "ethers";

describeSuite({
  id: "D01",
  title: "Dev test suite",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    const DUMMY_ACCOUNT = "0x11d88f59425cbc1867883fcf93614bf70e87E854";

    it({
      id: "E01",
      title: "Balance starts at 0",
      test: async () => {
        const balanceBefore = (await context.polkadotJs().query.system.account(DUMMY_ACCOUNT)).data
          .free;
        expect(balanceBefore.toString()).toEqual("0");
        log("Test account balance before transfer:", balanceBefore.toString());
        await context
          .polkadotJs()
          .tx.balances.transferAllowDeath(DUMMY_ACCOUNT, parseEther("1"))
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
      test: async () => {
        const balanceBefore = (await context.polkadotJs().query.system.account(DUMMY_ACCOUNT)).data
          .free;
        expect(balanceBefore.toString()).toEqual(parseEther("1").toString());
        await context
          .polkadotJs()
          .tx.balances.transferAllowDeath(DUMMY_ACCOUNT, parseEther("1"))
          .signAndSend(alith);
        await context.createBlock();
        const balanceAfter = (await context.polkadotJs().query.system.account(DUMMY_ACCOUNT)).data
          .free;
        expect(balanceAfter.sub(balanceBefore).toString()).toEqual(parseEther("1").toString());
      },
    });
  },
});
