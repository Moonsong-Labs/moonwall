import "@moonbeam-network/api-augment"
import { describeSuite, expect } from "@moonsong-labs/moonwall-cli";
import { getCurrentSuite } from "vitest/suite";
import { CHARLETH_ADDRESS, BALTATHAR_ADDRESS, alithSigner, alith } from "@moonsong-labs/moonwall-util";
import { parseEther } from "ethers";
import { BN } from "@polkadot/util";
import { beforeEach, beforeAll } from "vitest";
import { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "D01",
  title: "Dev test suite",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    let api;
    let w3;
    let polkadotJs: ApiPromise;

    beforeAll(async () => {
      polkadotJs = context.getMoonbeam();
      api = context.getEthers();
      w3 = context.getWeb3();
    });

    it({
      id: "T01",
      title: "Checking that launched node can create blocks",
      test: async function () {
        const block = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        await context.createBlock();
        const block2 = (await polkadotJs.rpc.chain.getBlock()).block.header.number.toNumber();
        log(`Previous block #${block}, new block #${block2}`)
        expect(block2).to.be.greaterThan(block);
      },
    });

    it({
      id: "T02",
      title: "Checking that substrate txns possible",
      timeout: 20000,
      test: async function () {
        const balanceBefore = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;

        await polkadotJs.tx.balances.transfer(BALTATHAR_ADDRESS, parseEther("2")).signAndSend(alith);
        await context.createBlock();

        const balanceAfter = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;
        expect(balanceBefore.lt(balanceAfter)).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Checking that sudo can be used",
      test: async function () {
        await context.createBlock();
        const tx = polkadotJs.tx.rootTesting.fillBlock(60 * 10 ** 7);
        await polkadotJs.tx.sudo.sudo(tx).signAndSend(alith);

        await context.createBlock();
        const blockFill = await polkadotJs.query.system.blockWeight();
        expect(blockFill.normal.refTime.unwrap().gt(new BN(0))).to.be.true;
      },
    });

    it({
      id: "T04",
      title: "Can send Ethers txns",
      test: async function () {
        const signer = alithSigner(api);
        const balanceBefore = (await polkadotJs.query.system.account(BALTATHAR_ADDRESS)).data.free;

        await signer.sendTransaction({
          to: BALTATHAR_ADDRESS,
          value: parseEther("1.0"),
          nonce: await signer.getNonce(),
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
      test: async function () {
        const expectedEvents = [
          polkadotJs.events.system.ExtrinsicSuccess,
          polkadotJs.events.balances.Transfer,
          // polkadotJs.events.authorFilter.EligibleUpdated
        ];

        const { match, events } = await context.createBlockAndCheck(
          expectedEvents,
          polkadotJs.tx.balances.transfer(CHARLETH_ADDRESS, parseEther("3"))
        );
        // maybe: reponse has methods for asserts
        // maybe: add options to createBlock for asserts of events/storages etc

        expect(match).toStrictEqual(true);
        // expect(
        //   events.some(
        //     (evt) =>
        //       polkadotJs.events.balances.Transfer.is(evt.event) &&
        //       evt.event.data.amount.toString() == parseEther("3")
        //   )
        // ).toStrictEqual(true);
      },
    });
  },
});
