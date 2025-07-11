import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import type { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "R01",
  title: "Sample suite that only runs on Moonriver chains",
  minRtVersion: 2200,
  foundationMethods: "read_only",
  testCases: ({ it, context, log }) => {
    let api: ApiPromise;

    beforeAll(() => {
      api = context.polkadotJs();
    });

    it({
      id: "C01",
      title: "This should run regardless of chain",
      test: async () => {
        log("Testing universal chain compatibility - checking spec version");
        expect(api.consts.system.version.specVersion.toNumber()).to.be.greaterThan(0);
      },
    });

    it({
      id: "C02",
      title: "This test should only run on moonriver",
      chainType: "moonriver",
      test: async () => {
        log("Testing Moonriver chain type filter - validating spec name");
        expect(api.consts.system.version.specName.toString()).to.be.equal("moonriver");
      },
    });

    it({
      id: "C03",
      title: "This test should only run on moonriver",
      notChainType: "moonbeam",
      test: async () => {
        log("Testing negative chain type filter - excluding Moonbeam chains");
        expect(api.consts.system.version.specName.toString()).to.be.equal("moonriver");
      },
    });

    it({
      id: "C04",
      title: "This test should always skip due to version num",
      minRtVersion: 2200,
      test: async () => {
        log("Testing runtime version constraint - requires minimum v2200");
        expect(api.consts.system.version.specVersion.toNumber()).to.be.greaterThanOrEqual(2200);
      },
    });
  },
});
