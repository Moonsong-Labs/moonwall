"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const runner_functions_1 = require("../../src/cli/runner/util/runner-functions");
const chai_1 = require("chai");
(0, runner_functions_1.testSuite)({
    id: 'P200',
    title: 'Tests that are using the production APIs',
    testCases: ({ context, it }) => {
        it('T01', 'Passing Test', async function () {
            console.log((await context.providers["MB"].query.system.account("0x1C86E56007FCBF759348dcF0479596a9857Ba105")).toHuman());
            console.log(context.providers["MB"].consts.system.version.specName.toString());
            console.log(context.providers["DOT"].consts.system.version.specName.toString());
            (0, chai_1.expect)(true).to.be.true;
        });
        it('T02', 'Skipped test', function () {
            (0, chai_1.expect)(true).to.be.true;
        });
    },
});
//# sourceMappingURL=test_apis.js.map