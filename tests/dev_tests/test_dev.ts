import { describeSuite } from "../../src/cli/runner/util/runner-functions";
import { alithSigner, resetToGenesis } from "../../src/utils/contextHelpers.js";
import { WebSocketProvider, parseEther } from "ethers";
import { setTimeout } from "timers/promises";
import {
  BALTATHAR_ADDRESS,
  alith,
  baltathar,
} from "../../src/cli/runner/lib/accounts.js";
import { BN } from "@polkadot/util";
import Web3 from "web3";
import { ApiPromise } from "@polkadot/api";
import { Foundation } from "../../src/cli/runner/lib/types.js";

describeSuite({
  id: "D01",
  title: "Dev test suite",
  foundationMethods: Foundation.Dev,
  testCases: ({ it, context }) => {
    let api: WebSocketProvider;
    let w3: Web3;
    let polkadotJs: ApiPromise;

    beforeAll(() => {
      api = context.getEthers();
      w3 = context.getWeb3();
      polkadotJs = context.getMoonbeam();
    });

    it({
      id: "E01",
      title: "Checking that launched node can create blocks",
      test: async function () {
        const block = (
          await polkadotJs.rpc.chain.getBlock()
        ).block.header.number.toNumber();
        await context.createBlock();
        const block2 = (
          await polkadotJs.rpc.chain.getBlock()
        ).block.header.number.toNumber();
        expect(block2).to.be.greaterThan(block);
      },
    });

    it({
      id: "E02",
      title: "Checking that substrate txns possible",
      timeout: 20000,
      test: async function () {
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
      },
    });

    it({
      id: "E03",
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
      id: "E04",
      title: "Can send Ethers txns",
      test: async function () {
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
      },
    });
  },
});
