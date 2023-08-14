import "@moonbeam-network/api-augment"
import { describeSuite, expect, beforeAll, MoonwallContext } from "@moonwall/cli";
import { Signer, ethers } from "ethers";

describeSuite({
  id: "S01",
  title: "ReadOnly test suite",
  foundationMethods: "read_only",
  testCases: ({ it, context, log }) => {
    let api: Signer;

    const whale = "0xF977814e90dA44bFA03b6295A0616a897441aceC"


    it({
      id: "T1",
      title: "this is a block Number case",
      test: async function (vitestContext) {
        log(vitestContext)
        log ( await context.ethers()!.provider!.getBlockNumber() )

        await context.waitBlock(1)
        log ( await context.ethers()!.provider!.getBlockNumber() )
        log ((await context.polkadotJs().rpc.chain.getBlock()).block.header.number.toNumber())
        
      },////////
    });


    it({
      id: "T2",
      title: "this is a balance test",
      test: async function (vitestContext) {
        log ( await context.ethers()!.provider!.getBalance(whale) )
        log ((await context.polkadotJs().query.system.account(whale)).data.free.toBigInt())
      },
    });



    
  },
});
