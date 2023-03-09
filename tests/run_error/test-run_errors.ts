import {
  describeSuite,
  ApiPromise,
  expect,
  beforeAll,
} from "@moonsong-labs/moonwall-cli";
import {
  ALITH_ADDRESS,
  CHARLETH_ADDRESS,
  ETHAN_ADDRESS,
  alith,
} from "@moonsong-labs/moonwall-util";
import Web3 from "web3";

describeSuite({
  id: "S100",
  title: "Testing for running against wrong network",
  foundationMethods: "dev",
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
        await context.createBlock();
      },
    });
  },
});
