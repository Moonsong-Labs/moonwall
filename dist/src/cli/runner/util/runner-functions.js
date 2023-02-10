"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSuite = void 0;
const globalContext_1 = require("./globalContext");
function testSuite({ id, title, testCases }) {
    describe(`🗃️  #${id} ${title}`, function () {
        let context = {
            providers: {},
            polkaCtx: (apiName) => context.providers[apiName],
            ethersApi: (apiName) => context.providers[apiName],
            web3Api: (apiName) => context.providers[apiName],
        };
        globalContext_1.MoonwallContext.getContext().providers.forEach((a) => {
            context.providers[a.name] = a.api;
        });
        function testCase(testcaseId, title, callback) {
            it(`📁  #${id.concat(testcaseId)} ${title}`, callback);
        }
        testCases({ context, it: testCase });
    });
}
exports.testSuite = testSuite;
//# sourceMappingURL=runner-functions.js.map