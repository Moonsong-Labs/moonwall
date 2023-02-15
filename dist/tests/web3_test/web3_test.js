import { expect } from "chai";
import { testSuite } from "../../src/cli/runner/util/runner-functions.js";
import { xcAssetAbi } from "../../src/cli/runner/lib/moonbeamConsts.js";
testSuite({
    id: "w3",
    title: "Web3 test suite",
    testCases: ({ it, context }) => {
        const web3 = context.getWeb3("w3");
        it("t1", "Calling chain data", async function () {
            console.log(`The latest block is ${(await web3.eth.getBlock("latest")).number}`);
            const bal = await web3.eth.getBalance("0x506172656E740000000000000000000000000000");
            console.log(web3.utils.fromWei(bal, "ether"));
            expect(bal > 0n).to.be.true;
        });
        it("t2", "Calling contract methods", async function () {
            const address = "0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d";
            const contract = new web3.eth.Contract(xcAssetAbi, address);
            const totalSupply = Number(await contract.methods.totalSupply().call());
            console.log(await contract.methods.symbol().call());
            console.log(`Total supply of ${await contract.methods
                .symbol()
                .call()} is ${web3.utils.fromWei(totalSupply, "micro")}`);
            expect(totalSupply > 0).to.be.true;
        });
    },
});
//# sourceMappingURL=web3_test.js.map