import { describeSuite, expect, beforeAll, ApiPromise, Web3 } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";

describeSuite({
  id: "S100",
  title: "Testing for running against wrong network",
  foundationMethods: "dev",
  testCases: ({ it, context }) => {
    let api: Web3;
    let mbApi: ApiPromise;

    beforeAll(() => {
      api = context.web3();
      mbApi = context.polkadotJs();
    });

    it({
      id: "E01",
      title: "Calling chain data",
      minRtVersion: 3000,
      test: async function () {
        console.log(`The latest block is ${(await api.eth.getBlock("latest")).number}`);
        const bal = Number(await api.eth.getBalance(ALITH_ADDRESS));
        expect(bal).to.be.greaterThan(0);
      },
    });

    it({
      id: "E02",
      title: "Create block",
      test: async function () {
        await context.createBlock();
        expect((await mbApi.rpc.chain.getBlock()).block.header.number.toNumber()).toBeGreaterThan(
          0
        );
      },
    });
  },
});
