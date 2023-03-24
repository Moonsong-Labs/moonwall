import { expect, describeSuite, beforeAll } from "@moonsong-labs/moonwall-cli";
import "@moonbeam-network/api-augment"

describeSuite({
  id: "Z1",
  title: "Zombie Test Suite",
  foundationMethods: "zombie",
  testCases: function ({ it,context, log }) {

    it({
      id: "T01",
      title: "This is a version test case",
      test: function () {
        const rt = context.getSubstrateApi().consts.system.version.specVersion.toNumber()
        expect(rt).to.be.greaterThan(0)
      },
    });

    it({
      id: "T02",
      title: "This is a network name test case",
      test: function () {
        const network = context.getSubstrateApi().consts.system.version.specName.toString()
        expect(network).to.contain("moonbase");
      },
    });


  },
});
