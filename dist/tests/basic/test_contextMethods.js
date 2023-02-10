"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const runner_functions_1 = require("../../src/cli/runner/util/runner-functions");
const chai_1 = require("chai");
(0, runner_functions_1.testSuite)({
    id: 'T100',
    title: 'New Test Suite',
    environment: "New_Test",
    testCases: ({ it }) => {
        it('T01', 'Passing Test', function () {
            (0, chai_1.expect)(true).to.be.true;
        });
        it('T02', 'Skipped test', function () {
            this.skip();
            (0, chai_1.expect)(false).to.be.true;
        });
    },
});
//# sourceMappingURL=test_contextMethods.js.map