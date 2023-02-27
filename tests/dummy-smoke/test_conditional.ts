import { ApiPromise } from "@polkadot/api";
import { parseEther } from "ethers";
import { Foundation, describeSuite } from "src";

describeSuite({
  id: "R01",
  title: "Sample suite that only runs on Moonriver chains",
  foundationMethods: Foundation.ReadOnly,
  testCases: ({ it, context }) => {
    let api: ApiPromise;
    let isntMoonriver: boolean;

    beforeAll(() => {
      api = context.getMoonbeam();
      isntMoonriver =
        api.consts.system.version.specName.toString() !== "moonriver";
        console.log(isntMoonriver)
    });

    it({
      id: "C01",
      title: "This should run regardless of chain",
      test: async function () {
        expect(
          api.consts.system.version.specVersion.toNumber()
        ).to.be.greaterThan(0);
      },
    });

    it({
      id: "C02",
      title: "This test should only run on moonriver",
      skipIf: isntMoonriver,
      test: async function () {
        expect(api.consts.system.version.specName.toString()).to.be.equal(
          "moonriver"
        );
      },
    });
  },
});
