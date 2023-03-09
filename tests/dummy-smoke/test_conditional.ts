import {
  describeSuite,
  ApiPromise,
  expect,
  beforeAll,
} from "@moonsong-labs/moonwall-cli";
const isntMoonriver = process.env.MW_RT_TYPE !== "moonriver";
const isntFutureRT = Number(process.env.MW_RT_VERSION) < 5000;

describeSuite({
  id: "R01",
  title: "Sample suite that only runs on Moonriver chains",
  foundationMethods: "read_only",
  testCases: ({ it, context }) => {
    let api: ApiPromise;

    beforeAll(() => {
      api = context.getMoonbeam();
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

    it({
      id: "C03",
      title: "This test should always skip due to version num",
      skipIf: isntFutureRT,
      test: async function () {
        expect(
          api.consts.system.version.specVersion.toNumber()
        ).to.be.greaterThanOrEqual(5000);
      },
    });
  },
});
