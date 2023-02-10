"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const runner_functions_1 = require("../../src/cli/runner/util/runner-functions");
const ethers_1 = require("ethers");
const moonbeam_consts_1 = require("../../src/cli/runner/lib/moonbeam_consts");
(0, runner_functions_1.testSuite)({
    id: "eth",
    title: "Ethers test suite",
    testCases: ({ it, context }) => {
        const api = context.ethersApi("eth");
        it("x01", "Calling chain data", async function () {
            console.log(`The latest block is ${(await api.getBlock("latest")).number}`);
            console.log(`The latest safe block is ${(await api.getBlock("safe")).number}`);
            const bal = Number(await api.getBalance("0x506172656E740000000000000000000000000000"));
            (0, chai_1.expect)(bal).to.be.greaterThan(0);
        });
        it("x02", "Accessing contract methods", async function () {
            const address = "0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d";
            const contract = new ethers_1.Contract(address, moonbeam_consts_1.xcAssetAbi, api);
            const totalSupply = await contract.totalSupply();
            const dps = await contract.decimals();
            console.log(`Total supply of ${await contract.symbol()} is ${(0, ethers_1.formatUnits)(totalSupply, dps)}`);
            (0, chai_1.expect)(totalSupply > 0).to.be.true;
        });
    },
});
//# sourceMappingURL=ethers_test.js.map