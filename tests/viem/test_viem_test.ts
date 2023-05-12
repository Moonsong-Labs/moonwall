import { expect, beforeAll, describeSuite, PublicViem } from "@moonwall/cli";
import { createPublicClient, webSocket, formatEther } from "viem";

describeSuite({
  id: "V01",
  title: "Viem Test Suite",
  foundationMethods: "read_only",
  testCases: ({ context, log, it }) => {
    let api: PublicViem;
    beforeAll(() => {
      api = context.viemClient("public");
    });

    it({
      id: "T01",
      title: "Query chain",
      test: async () => {
        const chainId = await api.getChainId();
        const bal = await api.getBalance({address: "0x3431e0dE19a9eB54d71bE71a2FDdB7e7b3225643"})
        log(`Balance is ${formatEther(bal)} on chain ${chainId}`)
        
      },
    });

    it({
      id: "T02",
      title: "Query account",
      test: async () => {
        // const pubClient = context.e
      },
    });

    it({
      id: "T03",
      title: "Query contract",
      test: async () => {
        // const pubClient = context.e
      },
    });
  },
});
