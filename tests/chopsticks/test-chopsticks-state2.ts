import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import { alith } from "@moonwall/util";
import { parseEther } from "ethers";
import { ApiPromise } from "@polkadot/api";
import "@polkadot/api-augment";

describeSuite({
  id: "S1",
  title: "Chopsticks test for state separation",
  foundationMethods: "chopsticks",
  testCases: ({ context, it }) => {
    let api: ApiPromise;

    const RANDOM_ADDRESS = "0x08dF22c93BCb4cFFE20bFc1F0c1Ad6fA75e7DFf6";

    beforeAll(() => {
      api = context.getSubstrateApi();
    });

    it({
      id: "T1",
      title: "Check initial balance is zero",
      test: async function () {
        const currentBalance = (await api.query.system.account(RANDOM_ADDRESS)).data.free;
        expect(currentBalance.eq(0)).toBeTruthy();
      },
    });

    it({
      id: "T2",
      title: "Send a transaction ",
      test: async function () {
        const currentBalance = (await api.query.system.account(RANDOM_ADDRESS)).data.free;
        await api.tx.balances.transfer(RANDOM_ADDRESS, parseEther("10")).signAndSend(alith);
        await context.createBlock();

        const balanceAfter = (await api.query.system.account(RANDOM_ADDRESS)).data.free;
        expect(currentBalance.lt(balanceAfter)).toBeTruthy();
      },
    });
  },
});