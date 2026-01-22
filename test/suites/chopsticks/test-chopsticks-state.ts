import "@moonbeam-network/api-augment";
import { describeSuite, expect, beforeAll } from "moonwall";
import { alith } from "moonwall";
import { parseEther } from "ethers";
import type { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "S1",
  title: "Chopsticks test for state separation",
  foundationMethods: "chopsticks",
  testCases: ({ context, it }) => {
    let api: ApiPromise;

    const RANDOM_ADDRESS = "0x08dF22c93BCb4cFFE20bFc1F0c1Ad6fA75e7DFf6";

    beforeAll(() => {
      api = context.polkadotJs();
    });

    it({
      id: "T01",
      title: "Check initial balance is zero",
      test: async () => {
        const currentBalance = (await api.query.system.account(RANDOM_ADDRESS)).data.free;
        expect(currentBalance.eq(0)).toBeTruthy();
      },
    });

    it({
      id: "T02",
      title: "Send a transaction ",
      test: async () => {
        const currentBalance = (await api.query.system.account(RANDOM_ADDRESS)).data.free;
        await api.tx.balances
          .transferAllowDeath(RANDOM_ADDRESS, parseEther("10"))
          .signAndSend(alith);
        await context.createBlock();

        const balanceAfter = (await api.query.system.account(RANDOM_ADDRESS)).data.free;
        expect(currentBalance.lt(balanceAfter)).toBeTruthy();
      },
    });
  },
});
