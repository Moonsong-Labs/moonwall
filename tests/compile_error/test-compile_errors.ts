import { expect } from "chai";
import { describeSuite } from "../../src/cli/runner/util/runner-functions.js";
import { createBlock } from "../../src/utils/contextHelpers.js";
import { Foundation } from "../../src/types/configAndContext.js";
import { ALITH_ADDRESS } from "../../src/cli/runner/lib/accounts.js";
import Web3 from "web3";
import { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "S100",
  title: "Testing for compile time errors",
  foundationMethods: Foundation.Dev,
  testCases: ({ it, context }) => {
    let api: Web3;
    let mbApi: ApiPromise;

    beforeAll(() => {
      api = context.getWeb3();
      mbApi = context.getMoonbeam();
    });

    it({
      id: "E01",
      title: "Calling chain data",
      test: async function () {
        console.log(
          `The latest block is ${(await api.eth.getBlock("latest")).number}`
        );
        const bal = Number(await api.eth.getBalance(ALITH_ADDRESS));
        expect(bal).to.be.greaterThan(0);
      },
    });

    it({
      id: "E02",
      title: "Create block",
      test: async function () {
        await createBlock(api, mbApi);
      },
    });
  },
});
