import { Foundation, describeSuite } from "../../src/index.js";
import { parseEther } from "ethers";
import { alith } from "../../src/cli/runner/lib/accounts.js";
import { ApiPromise } from "@polkadot/api";


describeSuite({
  id: "D02",
  title: "Dev test suite 2",
  foundationMethods: Foundation.Dev,
  testCases: ({ it, context }) => {
    let api: ApiPromise;
    const DUMMY_ACCOUNT = "0x11d88f59425cbc1867883fcf93614bf70e87E854";

    beforeAll(() => {
      api = context.getMoonbeam();
    });

    it({
      id: "E01",
      title: "Balance starts at 0",
      test: async function () {
        const balanceBefore = (await api.query.system.account(DUMMY_ACCOUNT))
          .data.free;
        expect(balanceBefore.toString()).toEqual("0");

        await api.tx.balances
          .transfer(DUMMY_ACCOUNT, parseEther("1"))
          .signAndSend(alith);
        await context.createBlock();
        const balanceAfter = (await api.query.system.account(DUMMY_ACCOUNT))
          .data.free;
        expect(balanceAfter.sub(balanceBefore).toString()).toEqual(
          parseEther("1").toString()
        );
      },
    });

    it({
      id: "E02",
      title: "State kept between tests",
      test: async function () {
        const balanceBefore = (await api.query.system.account(DUMMY_ACCOUNT))
          .data.free;
        expect(balanceBefore.toString()).toEqual(parseEther("1").toString());

        await api.tx.balances
          .transfer(DUMMY_ACCOUNT, parseEther("1"))
          .signAndSend(alith);
        await context.createBlock();
        const balanceAfter = (await api.query.system.account(DUMMY_ACCOUNT))
          .data.free;
        expect(balanceAfter.sub(balanceBefore).toString()).toEqual(
          parseEther("1").toString()
        );
      },
    });
  },
});

describeSuite({
  id: "D02",
  title: "Dev test suite",
  foundationMethods: Foundation.Dev,
  testCases: ({ it, context }) => {
    let api: ApiPromise;
    const DUMMY_ACCOUNT = "0x11d88f59425cbc1867883fcf93614bf70e87E854";

    beforeAll(() => {
      api = context.getMoonbeam();
    });

    it({
      id: "E01",
      title: "Checking that launched node can create blocks",
      test: async function () {
        const balanceBefore = (await api.query.system.account(DUMMY_ACCOUNT))
          .data.free;
        // expect(balanceBefore.toString()).toEqual("0");

        await api.tx.balances
          .transfer(DUMMY_ACCOUNT, parseEther("1"))
          .signAndSend(alith);

        await context.createBlock();

        const balanceAfter = (await api.query.system.account(DUMMY_ACCOUNT))
          .data.free;
        console.log(balanceBefore.toHuman());
        console.log(balanceAfter.toHuman());

        // expect(balanceAfter.sub(balanceBefore).toString()).toEqual(
        //   parseEther("1").toString()
        // );
      },
    });
  },
});
