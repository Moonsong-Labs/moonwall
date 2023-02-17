import { expect } from "vitest";
import { describeSuite } from "../../src/cli/runner/util/runner-functions.js";
import { Contract, WebSocketProvider, ethers, formatUnits } from "ethers";
import { xcAssetAbi } from "../../src/cli/runner/lib/moonbeamConsts.js";
import { createBlock } from "src/utils/contextHelpers.js";
import { MoonwallContext } from "../../src/index.js";
import Debug from "debug";
const debug = Debug("test:eth");

describeSuite({
  id: "S01",
  title: "Ethers test suite",
  testCases: ({it, context}) => {

    let api: WebSocketProvider

    beforeAll(()=>{
      console.log("Should be before each tc")
      api = context.getEthers()
    })

    it("T1","this is a test case", async function () {
      expect(true).toBe(true);
    });

    it("T2","this is a test case2", async function () {
      expect(2).toBeGreaterThan(0);
    });

    it("T3","this is a test case3", async function () {
      console.log(
        `The latest block is ${(await api.getBlock("latest")).number}`
      );
      debug(MoonwallContext.getContext().providers);
      expect(2).toBeGreaterThan(0);
    });

    it("T4", "Calling chain data", async function () {
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
    });


    it("T5", "Calling contract methods", async function () {
      const address = "0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d";
      const contract = new Contract(address,xcAssetAbi, api);
      const totalSupply = Number(await contract.totalSupply());
      console.log(
        `Total supply of ${await contract
          .symbol()
          } is ${formatUnits(totalSupply, await contract.decimals())}`
      );
      expect(totalSupply > 0).to.be.true;
    });
  },
});
