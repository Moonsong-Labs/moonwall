import { expect, describeSuite, beforeAll, ApiPromise, ethers } from "@moonwall/cli";
import { BALTATHAR_ADDRESS, alith } from "@moonwall/util";
import "@moonbeam-network/api-augment";

describeSuite({
  id: "Z1",
  title: "Zombie Test Suite",
  foundationMethods: "zombie",
  testCases: function ({ it, context, log }) {
    let paraApi: ApiPromise;
    let relayApi: ApiPromise;

    beforeAll(() => {
      paraApi = context.getSubstrateApi({ type: "moon" });
      relayApi = context.getSubstrateApi({ type: "polkadotJs" });
    });

    it({
      id: "T01",
      title: "This is a version test case",
      test: function () {
        const rt = relayApi.consts.system.version.specVersion.toNumber();
        expect(rt).to.be.greaterThan(0);
      },
    });

    it({
      id: "T02",
      title: "This is a network name test case",
      test: function () {
        const network = paraApi.consts.system.version.specName.toString();
        expect(network).to.contain("moonbase");
      },
    });

    it({
      id: "T03",
      title: "This is a network txn test case",
      timeout: 60000,
      test: async function () {
        const balBefore = (await paraApi.query.system.account(BALTATHAR_ADDRESS)).data.free;

        await new Promise((resolve) => {
          paraApi.tx.balances
            .transfer(BALTATHAR_ADDRESS, ethers.parseEther("2"))
            .signAndSend(alith, ({ status, events }) => {
              if (status.isInBlock) {
                log("Transaction is in block");
              }
              if (status.isFinalized) {
                log("Transaction is finalized!");
                resolve(events);
              }
            });
        });

        const balAfter = (await paraApi.query.system.account(BALTATHAR_ADDRESS)).data.free;
        expect(balBefore.lt(balAfter)).to.be.true;
      },
    });
  },
});
