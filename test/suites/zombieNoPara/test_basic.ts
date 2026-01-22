import "@moonbeam-network/api-augment";
import { beforeAll, describeSuite, expect } from "moonwall";
import type { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "Z1",
  title: "Zombie Test Suite",
  foundationMethods: "zombie",
  testCases: ({ it, context, log }) => {
    let relayApi: ApiPromise;

    beforeAll(async () => {
      relayApi = context.polkadotJs("relaychain");
    }, 10000);

    it({
      id: "T01",
      title: "Check relaychain api correctly connected",
      test: async () => {
        log("Testing relaychain API connection and spec validation");
        const rt = relayApi.consts.system.version.specVersion.toNumber();
        expect(rt).to.be.greaterThan(0);

        const network = relayApi.consts.system.version.specName.toString();
        log(`Connected to network: ${network}, spec version: ${rt}`);
        expect(network).to.contain("rococo");
      },
    });
  },
});
