"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const runner_functions_1 = require("../src/cli/runner/util/runner-functions");
const promises_1 = require("timers/promises");
const chai_1 = require("chai");
(0, runner_functions_1.testSuite)({
    id: 'T100',
    title: 'New Test Suite',
    environment: 'New_Test',
    testCases: function () {
        it('Sample test', () => {
            (0, chai_1.expect)(true).to.be.true;
        });
        it('Skipped test', function () {
            this.skip();
            (0, chai_1.expect)(true).to.be.true;
        });
        it('Failing test', () => {
            (0, chai_1.expect)(false).to.be.true;
        });
        it('Long test', async function () {
            await (0, promises_1.setTimeout)(5000);
            (0, chai_1.expect)(true).to.be.true;
        });
    },
});
//# sourceMappingURL=test_suiteMethods.js.map