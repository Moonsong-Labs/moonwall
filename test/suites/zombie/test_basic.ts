import "@moonbeam-network/api-augment";
import { beforeAll, describeSuite, expect } from "moonwall";
import { ALITH_ADDRESS, GLMR, baltathar } from "moonwall";
import { ApiPromise, WsProvider } from "@polkadot/api";

describeSuite({
  id: "Z1",
  title: "Zombie Test Suite",
  foundationMethods: "zombie",
  testCases: ({ it, context, log, logger }) => {
    let paraApi: ApiPromise;
    let relayApi: ApiPromise;

    beforeAll(async () => {
      paraApi = context.polkadotJs("parachain");
      relayApi = context.polkadotJs("relaychain");
    }, 10000);

    it({
      id: "T01",
      title: "Check relaychain api correctly connected",
      test: async () => {
        log("Testing relaychain API connection and version check");
        const rt = relayApi.consts.system.version.specVersion.toNumber();
        expect(rt).to.be.greaterThan(0);

        const network = relayApi.consts.system.version.specName.toString();
        expect(network).to.contain("rococo");
      },
    });

    it({
      id: "T02",
      title: "Check parachain api correctly connected",
      test: async () => {
        log("Testing parachain API connection and spec validation");
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
      test: async () => {
        log("Testing parachain block progression - waiting for 2 blocks");
        await context.waitBlock(2, "parachain", "height");
      },
    });

    it({
      id: "T04",
      title: "Can connect to parachain and execute a transaction",
      timeout: 360000,
      test: async () => {
        const balBefore = (await paraApi.query.system.account(ALITH_ADDRESS)).data.free;

        // log("Please wait, this will take a while until the transaction is finalized (slow runner)");

        // await new Promise((resolve) => {
        //   paraApi.tx.balances
        //     .transferAllowDeath(ALITH_ADDRESS, 2n * GLMR)
        //     .signAndSend(baltathar, ({ status, events }) => {
        //       if (status.isInBlock) {
        //         log("Transaction is in block");
        //       }
        //       if (status.isFinalized) {
        //         log("Transaction is finalized!");
        //         resolve(events);
        //       }
        //     });
        // });

        await paraApi.tx.balances
          .transferAllowDeath(ALITH_ADDRESS, 2n * GLMR)
          .signAndSend(baltathar);

        await context.waitBlock(4, "parachain", "quantity");
        const balAfter = (await paraApi.query.system.account(ALITH_ADDRESS)).data.free;
        expect(balBefore.lt(balAfter)).to.be.true;
      },
    });

    it({
      id: "T05",
      title: "Perform a runtime upgrade",
      timeout: 600000,
      modifier: "skip",
      test: async () => {
        await context.upgradeRuntime({ logger: log });
        log((await paraApi.rpc.chain.getBlock()).block.header.number.toNumber());
        await context.waitBlock(5, "parachain");
        log((await paraApi.rpc.chain.getBlock()).block.header.number.toNumber());
      },
    });

    it({
      id: "T06",
      title: "Restart a node from test script",
      timeout: 240000,
      test: async () => {
        log("Testing node restart functionality - restarting alith node");
        const initialHeight = (
          await context.polkadotJs("parachain").rpc.chain.getHeader()
        ).number.toNumber();
        logger.info("Initial height", initialHeight);
        await context.restartNode("alith");
        logger.info("Node restarted");

        const newApi = await ApiPromise.create({
          provider: new WsProvider("ws://localhost:33345"),
        });

        for (;;) {
          const newHeight = (await newApi.rpc.chain.getHeader()).number.toNumber();
          if (newHeight > initialHeight + 1) {
            logger.info(`New height ${newHeight}`);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      },
    });
  },
});
