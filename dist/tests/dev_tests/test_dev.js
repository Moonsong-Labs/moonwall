"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const runner_functions_1 = require("../../src/cli/runner/util/runner-functions");
(0, runner_functions_1.testSuite)({
    id: "dev",
    title: "Dev test suite",
    testCases: ({ it, context }) => {
        const api = context.ethersApi("eth");
        const polkadotJs = context.polkaCtx("eth");
        it("x01", "Checking that launched node can be queried", async function () {
        });
    },
});
//# sourceMappingURL=test_dev.js.map