import { describeSuite, expect, beforeAll, type ApiPromise, type Web3 } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";

describeSuite({
  id: "S100",
  title: "Testing for running against wrong network",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
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
      test: async () => {
        log("Testing chain data retrieval with Web3 API");
        console.log(`The latest block is ${(await api.eth.getBlock("latest")).number}`);
        const bal = Number(await api.eth.getBalance(ALITH_ADDRESS));
        log(`ALITH balance: ${bal}`);
        expect(bal).to.be.greaterThan(0);
      },
    });

    it({
      id: "E02",
      title: "Create block",
      test: async () => {
        log("Testing block creation functionality");
        await context.createBlock();
        const blockNumber = (await mbApi.rpc.chain.getBlock()).block.header.number.toNumber();
        log(`Created block number: ${blockNumber}`);
        expect(blockNumber).toBeGreaterThan(0);
      },
    });
  },
});
