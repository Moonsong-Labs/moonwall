import "@moonbeam-network/api-augment";
import { describeSuite, expect, beforeAll, MoonwallContext } from "@moonwall/cli";
import { BALTATHAR_ADDRESS, CHARLETH_ADDRESS, ETHAN_ADDRESS, alith } from "@moonwall/util";
import { parseEther, formatEther } from "ethers";

describeSuite({
  id: "X1",
  title: "Basic chopsticks test",
  foundationMethods: "chopsticks",
  testCases: ({ context, it, log }) => {

    beforeAll(() => {
    });

    it({
      id: "T01",
      title: "Query the chain",
      timeout: 60000,
      // modifier:"only",
      test: async function () {
        const chainName = context.polkadotJs().consts.system.version.specName.toString();
        const currentBlockHeight = (await context.polkadotJs().rpc.chain.getHeader()).number.toNumber();
        log(`You are now connected to ${chainName} at height #${currentBlockHeight}`);
        expect(currentBlockHeight).toBeGreaterThan(0);
        expect(["dancebox", "moonriver", "moonbeam"].includes(chainName)).toBe(true);
        log(JSON.stringify(await context.polkadotJs().rpc.state.getStorage(":code")).slice(0, 20));
        log(`This chain is an Ethereum chain: ${context.isEthereumChain}`);
        log(`Alith Address is: ${context.keyring.alice.address}`);
      },
    });

    it({
      id: "T02",
      title: "Send a transaction ",
      timeout: 60000,
      test: async function () {
        const currentBalance = (await context.polkadotJs().query.system.account(ETHAN_ADDRESS)).data.free;
        await context.polkadotJs().tx.balances.transfer(ETHAN_ADDRESS, parseEther("10")).signAndSend(alith);
        await context.createBlock();

        const balanceAfter = (await context.polkadotJs().query.system.account(ETHAN_ADDRESS)).data.free;
        expect(currentBalance.lt(balanceAfter)).toBeTruthy();
      },
    });

    it({
      id: "T03",
      title: "Skips multiple blocks ",
      timeout: 60000,
      test: async function () {
        const currentBlock = (await context.polkadotJs().rpc.chain.getHeader()).number.toNumber();
        await context.createBlock({ count: 3 });
        const laterBlock = (await context.polkadotJs().rpc.chain.getHeader()).number.toNumber();
        expect(laterBlock - currentBlock).toBe(3);
      },
    });

    it({
      id: "T04",
      title: "Can overwrite storage values",
      timeout: 60000,
      test: async function () {
        const storageValue = [
          [
            ["0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0"],
            { data: { free: "1337000000000000000000" }, nonce: 1 },
          ],
        ];

        const balBefore = (
          await context.polkadotJs().query.system.account("0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0")
        ).data.free;

        await context.setStorage({
          module: "System",
          method: "Account",
          methodParams: storageValue,
        });
        await context.createBlock();
        const balAfter = (
          await context.polkadotJs().query.system.account("0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0")
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
      id: "T05",
      title: "Do an upgrade test",
      timeout: 120000,
      modifier: "skip",
      test: async function () {
        const rtBefore = context.polkadotJs().consts.system.version.specVersion.toNumber();
        const ctx = await MoonwallContext.getContext();
        log(ctx.rtUpgradePath);
        await context.upgradeRuntime();
        const rtafter = context.polkadotJs().consts.system.version.specVersion.toNumber();
        expect(rtBefore).toBeLessThan(rtafter);
      },
    });

    it({
      id: "T06",
      title: "Create block and check events",
      timeout: 60000,
      test: async function () {
        const expectEvents = [
          context.polkadotJs().events.system.ExtrinsicSuccess,
          context.polkadotJs().events.balances.Transfer,
          context.polkadotJs().events.system.NewAccount,
          // context.polkadotJs().events.authorFilter.EligibleUpdated
        ];

        await context.polkadotJs().tx.balances.transfer(CHARLETH_ADDRESS, parseEther("3")).signAndSend(alith);
        await context.createBlock({ expectEvents, logger: log });
      },
    });

    it({
      id: "T07",
      title: "Create block, allow failures and check events",
      timeout: 60000,
      test: async function () {
        await context.polkadotJs().tx.balances
          .forceTransfer(BALTATHAR_ADDRESS, CHARLETH_ADDRESS, parseEther("3"))
          .signAndSend(alith);
        // await context.polkadotJs().tx.balances.transfer(CHARLETH_ADDRESS, parseEther("3")).signAndSend(alith);
        const { result } = await context.createBlock({ allowFailures: true });

        const apiAt = await context.polkadotJs().at(result);
        const events = await apiAt.query.system.events();
        expect(
          events.find((evt) => context.polkadotJs().events.system.ExtrinsicFailed.is(evt.event)),
          "No Event found in block"
        ).toBeTruthy();
      },
    });
  },
});
