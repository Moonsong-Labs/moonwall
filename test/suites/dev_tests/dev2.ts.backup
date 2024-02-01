import "@moonbeam-network/api-augment";
import { describeSuite, expect, beforeAll} from "@moonwall/cli";
import { CHARLETH_ADDRESS, BALTATHAR_ADDRESS, alith } from "@moonwall/util";
import { parseEther, Wallet } from "ethers";
import { BN } from "@polkadot/util";
import { ApiPromise } from "@polkadot/api";
import Web3 from "web3";
describeSuite({
  id: "D02",
  title: "Dev test suite2",
  foundationMethods: "dev",
  testCases: ({ it, context }) => {
    let signer: Wallet;
    let w3: Web3;
    let polkadotJs: ApiPromise;

    beforeAll(() => {
      signer = context.ethers();
      w3 = context.web3();
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

    it({
      id: "T02",
      title: "Checking that substrate txns possible",
      timeout: 20000,
      test: async () => {
        const balanceBefore = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;

        await polkadotJs.tx.balances
          .transferAllowDeath(BALTATHAR_ADDRESS, parseEther("2"))
          .signAndSend(alith);

        await context.createBlock();

        const balanceAfter = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;
        expect(balanceBefore.lt(balanceAfter)).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Checking that sudo can be used",
      test: async () => {
        await context.createBlock();
        const tx = polkadotJs.tx.rootTesting.fillBlock(60 * 10 ** 7);
        await polkadotJs.tx.sudo.sudo(tx).signAndSend(alith);

        polkadotJs;

        await context.createBlock();
        const blockFill = await polkadotJs.query.system.blockWeight();
        expect(blockFill.normal.refTime.unwrap().gt(new BN(0))).to.be.true;
      },
    });

    it({
      id: "T04",
      title: "Can send Ethers txns",
      test: async () => {
        const balanceBefore = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;
        await signer.sendTransaction({
          to: BALTATHAR_ADDRESS,
          value: parseEther("1.0"),
        });
        await context.createBlock();

        const balanceAfter = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;
        expect(balanceBefore.lt(balanceAfter)).to.be.true;
      },
    });

    it({
      id: "T05",
      title: "Testing out Create block and listen for event",
      // modifier: "only",
      timeout: 30000,
      test: async () => {
        const expectEvents = [
          polkadotJs.events.system.ExtrinsicSuccess,
          polkadotJs.events.balances.Transfer,
          // polkadotJs.events.authorFilter.EligibleUpdated
        ];

        await context.createBlock(
          polkadotJs.tx.balances.transferAllowDeath(CHARLETH_ADDRESS, parseEther("3")),
          { expectEvents }
        );
      },
    });
  },
});
