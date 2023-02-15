"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const runner_functions_1 = require("../../src/cli/runner/util/runner-functions");
const contextHelpers_1 = require("../../src/utils/contextHelpers");
const types_1 = require("../../src/cli/runner/lib/types");
const accounts_1 = require("../../src/cli/runner/lib/accounts");
(0, runner_functions_1.testSuite)({
    id: "S100",
    title: "Testing for compile time errors",
    supportedFoundations: [types_1.FoundationType.DevMode],
    testCases: ({ it, context }) => {
        const api = context.getWeb3();
        const mbApi = context.getMoonbeam();
        it("E01", "Calling chain data", async function () {
            console.log(`The latest block is ${(await api.eth.getBlock("latest")).number}`);
            const bal = Number(await api.eth.getBalance(accounts_1.ALITH_ADDRESS));
            (0, chai_1.expect)(bal).to.be.greaterThan(0);
        });
        it("E02", "Create block", async function () {
            await (0, contextHelpers_1.createBlock)(api, mbApi);
        });
    },
});
//# sourceMappingURL=compile_errors.js.map