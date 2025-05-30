import { describeSuite, expect, beforeAll } from "@moonwall/cli";
import { xcAssetAbi } from "@moonwall/util";
import type Web3 from "web3";

describeSuite({
  id: "W3",
  title: "Web3 test suite",
  foundationMethods: "read_only",
  testCases: ({ it, context, log }) => {
    let web3: Web3;

    beforeAll(() => {
      web3 = context.web3();
    });

    it({
      id: "T1",
      title: "Calling chain data",
      timeout: 60000,
      test: async () => {
        log(`The latest block is ${(await web3.eth.getBlock("latest")).number}`);
        const bal = await web3.eth.getBalance("0x506172656E740000000000000000000000000000");
        log(web3.utils.fromWei(bal, "ether"));
        expect(bal > 0n).to.be.true;
      },
    });

    it({
      id: "T2",
      title: "Calling contract methods",
      test: async () => {
        const address = "0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080";
        const contract = new web3.eth.Contract(xcAssetAbi, address);
        const totalSupply = Number(await contract.methods.totalSupply().call());
        log(await contract.methods.symbol().call());

        log(
          `Total supply of ${await contract.methods.symbol().call()} is ${web3.utils.fromWei(
            totalSupply,
            "micro"
          )}`
        );
        expect(totalSupply > 0).to.be.true;
      },
    });

    it({
      id: "T3",
      title: "Can wait for new block",
      timeout: 40000,
      test: async () => {
        const api = context.polkadotJs();

        const blockNum = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
        await context.waitBlock(2);
        const newBlockNum = (await api.rpc.chain.getBlock()).block.header.number.toNumber();
        expect(newBlockNum).to.be.greaterThan(blockNum);
      },
    });
  },
});
