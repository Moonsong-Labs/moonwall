import { type ViemClient, beforeAll, describeSuite, expect } from "@moonwall/cli";
import { xcAssetAbi } from "@moonwall/util";
import { formatEther, formatUnits, getContract } from "viem";

describeSuite({
  id: "V01",
  title: "Viem Test Suite",
  foundationMethods: "read_only",
  testCases: ({ context, log, it }) => {
    let api: ViemClient;
    beforeAll(() => {
      api = context.viem();
    });

    it({
      id: "T01",
      title: "Query chain",
      test: async () => {
        const chainId = await api.getChainId();
        const gasUsed = (await api.getBlock()).gasUsed;
        const blockNumber = await api.getBlockNumber();
        log(`Block #${blockNumber} used ${gasUsed} gas on chain ${chainId}`);
        expect(blockNumber > 0).to.be.true;
      },
    });

    it({
      id: "T02",
      title: "Query account",
      test: async () => {
        const bal = await api.getBalance({ address: "0x3431e0dE19a9eB54d71bE71a2FDdB7e7b3225643" });
        log(`Balance is ${formatEther(bal)}`);
        expect(bal > 0n).to.be.true;
      },
    });

    it({
      id: "T03",
      title: "Query contract",
      test: async () => {
        const address = "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b";
        const contract = getContract({
          address,
          abi: xcAssetAbi,
          client: { public: api, wallet: api },
        });
        const decimals = (await contract.read.decimals()) as number;
        const totalSupply = (await contract.read.totalSupply()) as bigint;
        const symbol = (await contract.read.symbol()) as string;

        log(`Total supply of ${symbol} is ${formatUnits(totalSupply, decimals)}`);
        expect(totalSupply > 0n).to.be.true;
        expect(decimals > 0).to.be.true;
        expect(symbol.length).to.be.greaterThan(0);
      },
    });
  },
});
