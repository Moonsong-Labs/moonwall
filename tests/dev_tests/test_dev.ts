import { testSuite } from "../../src/cli/runner/util/runner-functions";
import { alithSigner, resetToGenesis } from "../../src/utils/contextHelpers.js";
import { WebSocketProvider, parseEther } from "ethers";
import {
  BALTATHAR_ADDRESS,
  alith,
  baltathar,
} from "../../src/cli/runner/lib/accounts.js";
import { BN } from "@polkadot/util";
import Web3 from "web3";
import { ApiPromise } from "@polkadot/api";
import { Foundation } from "../../src/cli/runner/lib/types.js";

testSuite({
  id: "dev",
  title: "Dev test suite",
  foundationMethods: Foundation.Dev,
  testCases: ({ it, context }) => {
    let api: WebSocketProvider;
    let w3: Web3;
    let polkadotJs: ApiPromise;

    beforeAll(() => {
      api = context.getEthers();
      w3 = context.getWeb3();
      polkadotJs = context.getPolkadotJs();
    });

    it(
      "E01",
      "Checking that launched node can create blocks",
      async function () {
        const block = (
          await context.getPolkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        await context.createBlock();
        const block2 = (
          await context.getPolkadotJs().rpc.chain.getBlock()
        ).block.header.number.toNumber();
        expect(block2).to.be.greaterThan(block);
      }
    );

    it("E02", "Checking that substrate txns possible", async function () {
      const balanceBefore = (
        await polkadotJs.query.system.account(BALTATHAR_ADDRESS)
      ).data.free;
      await polkadotJs.tx.balances
        .transfer(BALTATHAR_ADDRESS, parseEther("2"))
        .signAndSend(alith);

      await context.createBlock();

      const balanceAfter = (
        await polkadotJs.query.system.account(BALTATHAR_ADDRESS)
      ).data.free;
      expect(balanceBefore.lt(balanceAfter)).to.be.true;
    });

    it("E03", "Checking that sudo can be used", async function () {
      await context.createBlock();
      const tx = polkadotJs.tx.system.fillBlock(60 * 10 ** 7);
      await polkadotJs.tx.sudo.sudo(tx).signAndSend(alith);

      await context.createBlock();
      const blockFill = await polkadotJs.query.system.blockWeight();
      expect(blockFill.normal.refTime.unwrap().gt(new BN(0))).to.be.true;
    });

    it("E04", "Can send Ethers txns", async function () {
      const signer = alithSigner(api);
      const balanceBefore = (
        await polkadotJs.query.system.account(BALTATHAR_ADDRESS)
      ).data.free;

      await signer.sendTransaction({
        to: BALTATHAR_ADDRESS,
        value: parseEther("1.0"),
      });
      await context.createBlock();

      const balanceAfter = (
        await polkadotJs.query.system.account(BALTATHAR_ADDRESS)
      ).data.free;
      expect(balanceBefore.lt(balanceAfter)).to.be.true;
    });
  },
});
