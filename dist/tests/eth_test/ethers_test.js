import { expect } from "chai";
import { testSuite } from "../../src/cli/runner/util/runner-functions.js";
import { Contract, formatUnits } from "ethers";
import { xcAssetAbi } from "../../src/cli/runner/lib/moonbeamConsts.js";
console.log("hello");
testSuite({
    id: "S100",
    title: "Ethers test suite",
    testCases: ({ it, context }) => {
        const api = context.getEthers();
        it("E01", "Calling chain data", async function () {
            console.log(`The latest block is ${(await api.getBlock("latest")).number}`);
            console.log(`The latest safe block is ${(await api.getBlock("safe")).number}`);
            const bal = Number(await api.getBalance("0x506172656E740000000000000000000000000000"));
            expect(bal).to.be.greaterThan(0);
        });
        it("E02", "Accessing contract methods", async function () {
            const address = "0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d";
            const contract = new Contract(address, xcAssetAbi, api);
            const totalSupply = await contract.totalSupply();
            const dps = await contract.decimals();
            console.log(`Total supply of ${await contract.symbol()} is ${formatUnits(totalSupply, dps)}`);
            expect(totalSupply > 0).to.be.true;
        });
    },
});
//# sourceMappingURL=ethers_test.js.map