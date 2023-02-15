"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const runner_functions_1 = require("../../src/cli/runner/util/runner-functions");
const contextHelpers_1 = require("../../src/utils/contextHelpers");
const ethers_1 = require("ethers");
const accounts_1 = require("../../src/cli/runner/lib/accounts");
const util_1 = require("@polkadot/util");
(0, runner_functions_1.testSuite)({
    id: "dev",
    title: "Dev test suite",
    testCases: ({ it, context }) => {
        const api = context.getEthers();
        const w3 = context.getWeb3();
        const polkadotJs = context.getPolkadotJs();
        beforeEach(async () => {
            await (0, contextHelpers_1.resetToGenesis)(polkadotJs);
        });
        it("E01", "Checking that launched node can create blocks", async function () {
            const block = (await context.getPolkadotJs().rpc.chain.getBlock()).block.header.number.toNumber();
            await (0, contextHelpers_1.createBlock)(w3, context.getPolkadotJs());
            const block2 = (await context.getPolkadotJs().rpc.chain.getBlock()).block.header.number.toNumber();
            (0, chai_1.expect)(block2).to.be.greaterThan(block);
        });
        it("E02", "Checking that substrate txns possible", async function () {
            const balanceBefore = (await polkadotJs.query.system.account(accounts_1.BALTATHAR_ADDRESS)).data.free;
            await polkadotJs.tx.balances
                .transfer(accounts_1.BALTATHAR_ADDRESS, (0, ethers_1.parseEther)("2"))
                .signAndSend(accounts_1.alith);
            await (0, contextHelpers_1.createBlock)(w3, polkadotJs);
            const balanceAfter = (await polkadotJs.query.system.account(accounts_1.BALTATHAR_ADDRESS)).data.free;
            (0, chai_1.expect)(balanceBefore.lt(balanceAfter)).to.be.true;
        });
        it("E03", "Checking that sudo can be used", async function () {
            await (0, contextHelpers_1.createBlock)(w3, polkadotJs);
            const tx = polkadotJs.tx.system.fillBlock(60 * 10 ** 7);
            await polkadotJs.tx.sudo.sudo(tx).signAndSend(accounts_1.alith);
            await (0, contextHelpers_1.createBlock)(w3, polkadotJs);
            const blockFill = await polkadotJs.query.system.blockWeight();
            (0, chai_1.expect)(blockFill.normal.refTime.unwrap().gt(new util_1.BN(0))).to.be.true;
        });
        it("E04", "Can send Ethers txns", async function () {
            const signer = (0, contextHelpers_1.alithSigner)(api);
            const balanceBefore = (await polkadotJs.query.system.account(accounts_1.BALTATHAR_ADDRESS)).data.free;
            await signer.sendTransaction({
                to: accounts_1.BALTATHAR_ADDRESS,
                value: (0, ethers_1.parseEther)("1.0"),
            });
            await (0, contextHelpers_1.createBlock)(w3, polkadotJs);
            const balanceAfter = (await polkadotJs.query.system.account(accounts_1.BALTATHAR_ADDRESS)).data.free;
            (0, chai_1.expect)(balanceBefore.lt(balanceAfter)).to.be.true;
        });
    },
});
//# sourceMappingURL=test_dev.js.map