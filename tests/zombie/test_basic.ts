import "@moonbeam-network/api-augment";
import { expect, describeSuite, beforeAll } from "@moonwall/cli";
import { ethers } from "ethers";
import { BALTATHAR_ADDRESS, alith } from "@moonwall/util";
import { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "Z1",
  title: "Zombie Test Suite",
  foundationMethods: "zombie",
  testCases: function ({ it, context, log }) {
    let paraApi: ApiPromise;
    let relayApi: ApiPromise;

    beforeAll(() => {
      paraApi = context.polkadotJs("parachain");
      relayApi = context.polkadotJs("relaychain");
    });

    it({
      id: "T01",
      title: "Check relaychain api correctly connected",
      test: function () {
        const rt = relayApi.consts.system.version.specVersion.toNumber();
        expect(rt).to.be.greaterThan(0);

        const network = relayApi.consts.system.version.specName.toString();
        expect(network).to.contain("rococo");
      },
    });

    it({
      id: "T02",
      title: "Check parachain api correctly connected",
      test: async function () {
        const network = paraApi.consts.system.version.specName.toString();
        expect(network).to.contain("moonbase");

        const rt = paraApi.consts.system.version.specVersion.toNumber();
        expect(rt).to.be.greaterThan(0);
      },
    });

    it({
      id: "T03",
      title: "Check parachain api correctly connected (2)",
      timeout: 120000,
      test: async function () {
        await context.waitBlock(5, "parachain", "height");
      },
    });

    it({
      id: "T04",
      title: "Can connect to parachain and execute a transaction",
      timeout: 60000,
      test: async function () {
        const balBefore = (await paraApi.query.system.account(BALTATHAR_ADDRESS)).data.free;

        log("Please wait, this will take at least 30s for transaction to complete");

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

    it({
      id: "T05",
      title: "Perform a runtime upgrade",
      timeout: 600000,
      modifier: "skip",
      test: async function () {
        await context.upgradeRuntime({ logger: log });
        log((await paraApi.rpc.chain.getBlock()).block.header.number.toNumber());
        await context.waitBlock(5, "parachain");
        log((await paraApi.rpc.chain.getBlock()).block.header.number.toNumber());
      },
    });
  },
});
