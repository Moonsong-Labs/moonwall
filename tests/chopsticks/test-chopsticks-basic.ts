import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import {
  BALTATHAR_ADDRESS,
  CHARLETH_ADDRESS,
  ETHAN_ADDRESS,
  alith,
} from "@moonwall/util";
import { parseEther, formatEther } from "ethers";
import { ApiPromise } from "@polkadot/api";
import "@moonbeam-network/api-augment";

describeSuite({
  id: "X1",
  title: "Basic chopsticks test",
  foundationMethods: "chopsticks",
  testCases: ({ context, it, log }) => {
    let api: ApiPromise;

    beforeAll(() => {
      api = context.polkadotJs({type: "moon"})
    });

    it({
      id: "T1",
      title: "Query the chain",
      test: async function () {
        const chainName = api.consts.system.version.specName.toString();
        const currentBlockHeight = (await api.rpc.chain.getHeader()).number.toNumber();
        log(`You are now connected to ${chainName} at height #${currentBlockHeight}`);
        expect(currentBlockHeight).toBeGreaterThan(0);
        expect(chainName).toBe("moonriver");
        log(JSON.stringify(await api.rpc.state.getStorage(":code")).slice(0,20))
      },
    });

    it({
      id: "T2",
      title: "Send a transaction ",
      test: async function () {
        const currentBalance = (await api.query.system.account(ETHAN_ADDRESS)).data.free;
        await api.tx.balances.transfer(ETHAN_ADDRESS, parseEther("10")).signAndSend(alith);
        await context.createBlock();

        const balanceAfter = (await api.query.system.account(ETHAN_ADDRESS)).data.free;
        expect(currentBalance.lt(balanceAfter)).toBeTruthy();
      },
    });

    it({
      id: "T3",
      title: "Skips multiple blocks ",
      timeout: 20000,
      test: async function () {
        const currentBlock = (await api.rpc.chain.getHeader()).number.toNumber();
        await context.createBlock({ count: 3 });
        const laterBlock = (await api.rpc.chain.getHeader()).number.toNumber();
        expect(laterBlock - currentBlock).toBe(3);
      },
    });

    it({
      id: "T4",
      title: "Can overwrite storage values",
      timeout: 30000,
      test: async function () {
        const storageValue = [
          [
            ["0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0"],
            { data: { free: "1337000000000000000000" }, nonce: 1 },
          ],
        ];

        const balBefore = (
          await api.query.system.account("0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0")
        ).data.free;

        await context.setStorage({
          module: "System",
          method: "Account",
          methodParams: storageValue,
        });
        await context.createBlock();
        const balAfter = (
          await api.query.system.account("0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0")
        ).data.free;
        log(
          `Balance of 0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0 before: ${formatEther(
            balBefore.toString()
          )} GLMR; after: ${formatEther(balAfter.toString())} GLMR`
        );

        expect(balBefore.lt(balAfter));
      },
    });

    it({
      id: "T5",
      title: "Do an upgrade test",
      timeout: 120000,
      modifier: "skip",
      test: async function () {
        const rtBefore = api.consts.system.version.specVersion.toNumber();
        await context.upgradeRuntime(context);
        const rtafter = api.consts.system.version.specVersion.toNumber();
        expect(rtBefore).toBeLessThan(rtafter);
      },
    });

    it({
      id: "T6",
      title: "Create block and check events",
      test: async function () {
        const expectEvents = [
          api.events.system.ExtrinsicSuccess,
          api.events.balances.Transfer,
          api.events.system.NewAccount,
          // api.events.authorFilter.EligibleUpdated
        ];

        await api.tx.balances.transfer(CHARLETH_ADDRESS, parseEther("3")).signAndSend(alith);
        await context.createBlock({ expectEvents, logger: log });
      },
    });

    it({
      id: "T7",
      title: "Create block, allow failures and check events",
      test: async function () {
        await api.tx.balances
          .forceTransfer(BALTATHAR_ADDRESS, CHARLETH_ADDRESS, parseEther("3"))
          .signAndSend(alith);
        // await api.tx.balances.transfer(CHARLETH_ADDRESS, parseEther("3")).signAndSend(alith);
        const { result } = await context.createBlock({ allowFailures: true });

        const apiAt = await api.at(result);
        const events = await apiAt.query.system.events();
        expect(
          events.find((evt) => api.events.system.ExtrinsicFailed.is(evt.event)),
          "No Event found in block"
        ).toBeTruthy();
      },
    });
  },
});
