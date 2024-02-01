import "@moonbeam-network/api-augment";
import { describeSuite } from "@moonwall/cli";
import { checkBlockFinalized } from "@moonwall/util";
import { Wallet } from "ethers";

describeSuite({
  id: "S01",
  title: "ReadOnly test suite",
  foundationMethods: "read_only",
  testCases: ({ it, context, log }) => {
    let api: Wallet;

    const whale = "0xF977814e90dA44bFA03b6295A0616a897441aceC";

    it({
      id: "T1",
      title: "this is a block Number case",
      test: async (vitestContext) => {
        log(vitestContext);
        log(await context.ethers()!.provider!.getBlockNumber());

        await context.waitBlock(1);
        log(await context.ethers()!.provider!.getBlockNumber());
        log((await context.polkadotJs().rpc.chain.getBlock()).block.header.number.toNumber());
      },
    });

    it({
      id: "T2",
      title: "this is a balance test",
      test: async (vitestContext) => {
        log(await context.ethers()!.provider!.getBalance(whale));
        log((await context.polkadotJs().query.system.account(whale)).data.free.toBigInt());
      },
    });

    it({
      id: "T3",
      title: "this is a block finalize test",
      test: async (vitestContext) => {
        log(
          await checkBlockFinalized(
            context.polkadotJs(),
            (await context.ethers().provider!.getBlockNumber()) - 5
          )
        );
      },
    });
  },
});
