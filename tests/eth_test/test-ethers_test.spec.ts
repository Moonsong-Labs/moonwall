import { expect } from "vitest";
import { describeSuite } from "../../src/index.js";
import { Contract, WebSocketProvider, ethers, formatUnits } from "ethers";
import { xcAssetAbi } from "../../src/cli/lib/moonbeamConsts.js";
import { createBlock } from "src/utils/contextHelpers.js";
import { MoonwallContext } from "../../src/index.js";
import Debug from "debug";
const debug = Debug("test:eth");

describeSuite({
  id: "S01",
  title: "Ethers test suite",
  foundationMethods: "read_only",
  testCases: ({ it, context }) => {
    let api: WebSocketProvider;

    beforeAll(() => {
      console.log("Should be before each tc");
      api = context.getEthers();
    });

    it({
      id: "T1",
      title: "this is a test case",
      test: async function () {
        expect(true).toBe(true);
      },
    });

    it({
      id: "T2",
      title: "this is a test case2",
      test: async function () {
        expect(2).toBeGreaterThan(0);
      },
    });

    it({
      id: "T3",
      title: "this is a test case3",
      test: async function () {
        console.log(
          `The latest block is ${(await api.getBlock("latest")).number}`
        );
        debug(MoonwallContext.getContext().providers);
        expect(2).toBeGreaterThan(0);
      },
    });

    it({
      id: "T4",
      title: "Calling chain data",
      test: async function () {
        console.log(
          `The latest block is ${(await api.getBlock("latest")).number}`
        );
        console.log(
          `The latest safe block is ${(await api.getBlock("safe")).number}`
        );
        const bal = Number(
          await api.getBalance("0x506172656E740000000000000000000000000000")
        );
        expect(bal).to.be.greaterThan(0);
      },
    });

    it({
      id: "T5",
      title: "Calling contract methods",
      test: async function () {
        const address = "0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d";
        const contract = new Contract(address, xcAssetAbi, api);
        const totalSupply = Number(await contract.totalSupply());
        console.log(
          `Total supply of ${await contract.symbol()} is ${formatUnits(
            totalSupply,
            await contract.decimals()
          )}`
        );
        expect(totalSupply > 0).to.be.true;
      },
    });
  },
});
