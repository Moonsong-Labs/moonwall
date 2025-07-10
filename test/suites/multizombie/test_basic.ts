import "@moonbeam-network/api-augment";
import { expect, describeSuite, beforeAll } from "@moonwall/cli";
import type { ApiPromise } from "@polkadot/api";

describeSuite({
  id: "Z1",
  title: "Zombie Test Suite",
  foundationMethods: "zombie",
  testCases: ({ it, context, log }) => {
    let para1Api: ApiPromise;
    let para2Api: ApiPromise;

    beforeAll(() => {
      para1Api = context.polkadotJs("para1");
      para2Api = context.polkadotJs("para2");
    });

    it({
      id: "T01",
      title: "Check para1 api correctly connected",
      timeout: 60000,
      test: async () => {
        const rt = para1Api.consts.system.version.specVersion.toNumber();
        expect(rt).to.be.greaterThan(0);

        const network = para1Api.consts.system.version.specName.toString();
        log(network);
        log(
          `Para1 block number: ${(await para1Api.rpc.chain.getBlock()).block.header.number.toNumber()}`
        );
        await context.waitBlock(2, "para1");
        log(
          ` Para1 block number after wait: ${(await para1Api.rpc.chain.getBlock()).block.header.number.toNumber()}`
        );
      },
    });

    it({
      id: "T02",
      title: "Check parachain api correctly connected",
      test: async () => {
        const rt = para2Api.consts.system.version.specVersion.toNumber();
        expect(rt).to.be.greaterThan(0);

        const network = para2Api.consts.system.version.specName.toString();
        log(network);
      },
    });
  },
});
