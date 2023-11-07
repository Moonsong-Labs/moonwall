import "@moonbeam-network/api-augment";
import "@polkadot/api-augment";
import { beforeAll, describeSuite, expect } from "@moonwall/cli";
import net from "net";
import { ALITH_ADDRESS, GLMR, baltathar } from "@moonwall/util";
import { ApiPromise } from "@polkadot/api";
import { setTimeout as timer } from "timers/promises";
import { stat } from "fs";

describeSuite({
  id: "Z1",
  title: "Zombie Test Suite",
  foundationMethods: "zombie",
  testCases: function ({ it, context, log }) {
    let paraApi: ApiPromise;
    let relayApi: ApiPromise;

    beforeAll(async () => {
      paraApi = context.polkadotJs("parachain");
      relayApi = context.polkadotJs("relaychain");
    }, 10000);

    it({
      id: "T01",
      title: "Check relaychain api correctly connected",
      test: async function () {
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
        const socketPath = process.env.MOON_IPC_SOCKET;
        const client = net.createConnection({ path: socketPath }, () => {
          client.write("Hello from client again");
        });

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
        const balBefore = (await paraApi.query.system.account(ALITH_ADDRESS)).data.free;

        log("Please wait, this will take at least 30s for transaction to complete");

        await new Promise((resolve) => {
          paraApi.tx.balances
            .transfer(ALITH_ADDRESS, 2n * GLMR)
            .signAndSend(baltathar, ({ status, events }) => {
              if (status.isInBlock) {
                log("Transaction is in block");
              }
              if (status.isFinalized) {
                log("Transaction is finalized!");
                resolve(events);
              }
            });
        });

        const balAfter = (await paraApi.query.system.account(ALITH_ADDRESS)).data.free;
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

    it({
      id: "T06",
      title: "Restart a node from test script",
      timeout: 600000,
      test: async function () {
        await context.restartNode("alith");
        await context.waitBlock(2, "parachain", "quantity");
      },
    });

    it({
      id: "T07",
      title: "Pause/Resume a node",
      timeout: 600000,
      test: async function () {

        // await context.pauseNode("alice");
        
        await context.killNode("alice");
        const status  = await context.isUp("alice");

        log(status);
        expect(status).toBe(false)
        // expect(await context.isUp("alith"), "Alith node is not running").toBe(true);
        // const blockBefore = (await paraApi.rpc.chain.getBlock()).block.header.number.toNumber();
        // await context.pauseNode("alith");
        // log("waiting 20s and checking block production is paused");
        // await timer(20000);
        // const blockAfter = (await paraApi.rpc.chain.getBlock()).block.header.number.toNumber();
        // expect(blockBefore).to.be.equal(blockAfter);
        // expect(await context.isUp("alith"), "Alith node is not paused").toBe(false);

        // await context.resumeNode("alith");
        // await context.waitBlock(1, "parachain", "quantity");
        // const blockAfterResume = (
        //   await paraApi.rpc.chain.getBlock()
        // ).block.header.number.toNumber();
        // expect(blockAfterResume).to.be.greaterThan(blockAfter);
      },
    });
  },
});
