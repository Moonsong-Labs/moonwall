import { describeSuite, expect, beforeAll, Signer, MoonwallContext } from "@moonwall/cli";
import { xcAssetAbi } from "@moonwall/util";
import { ethers } from "ethers";

describeSuite({
  id: "S01",
  title: "Ethers test suite",
  foundationMethods: "read_only",
  testCases: ({ it, context, log }) => {
    let api: Signer;

    beforeAll(() => {
      log("Should be before each tc");
      api = context.ethersSigner();
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
        console.log(`The latest block is ${(await api.provider!.getBlock("latest"))!.number}`);
        log(MoonwallContext.getContext()!.providers);
        expect(2).toBeGreaterThan(0);
      },
    });

    it({
      id: "T4",
      title: "Calling chain data",
      test: async function () {
        log(`The latest block is ${(await api.provider!.getBlock("latest"))!.number}`);
        log(`The latest safe block is ${(await api.provider!.getBlock("safe"))!.number}`);
        const bal = Number(
          await api.provider!.getBalance("0x506172656E740000000000000000000000000000")
        );
        expect(bal).to.be.greaterThan(0);
      },
    });

    it({
      id: "T5",
      title: "Calling contract methods",
      test: async function () {
        const address = "0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d";
        const contract = new ethers.Contract(address, xcAssetAbi, api);
        const totalSupply = Number(await contract.totalSupply());
        log(
          `Total supply of ${await contract.symbol()} is ${ethers.formatUnits(
            totalSupply,
            await contract.decimals()
          )}`
        );
        expect(totalSupply > 0).to.be.true;
      },
    });
  },
});
