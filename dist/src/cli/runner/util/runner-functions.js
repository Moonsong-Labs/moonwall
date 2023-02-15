"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSuite = void 0;
const globalContext_1 = require("../internal/globalContext");
const types_1 = require("../lib/types");
function testSuite({ id, title, testCases, supportedFoundations, }) {
    const ctx = globalContext_1.MoonwallContext.getContext();
    describe(`🗃️  #${id} ${title}`, function () {
        let context = {
            providers: {},
            getPolkadotJs: (apiName) => {
                if (apiName) {
                    return context.providers[apiName];
                }
                else {
                    return globalContext_1.MoonwallContext.getContext().providers.find((a) => a.type == types_1.ProviderType.PolkadotJs).api;
                }
            },
            getMoonbeam: (apiName) => {
                if (apiName) {
                    return context.providers[apiName];
                }
                else {
                    return globalContext_1.MoonwallContext.getContext().providers.find((a) => a.type == types_1.ProviderType.Moonbeam).api;
                }
            },
            getEthers: (apiName) => {
                if (apiName) {
                    return context.providers[apiName];
                }
                else {
                    return globalContext_1.MoonwallContext.getContext().providers.find((a) => a.type == types_1.ProviderType.Ethers).api;
                }
            },
            getWeb3: (apiName) => {
                if (apiName) {
                    return context.providers[apiName];
                }
                else {
                    return globalContext_1.MoonwallContext.getContext().providers.find((a) => a.type == types_1.ProviderType.Web3).api;
                }
            },
        };
        console.log("genesis is " + ctx.genesis);
        if (supportedFoundations &&
            !supportedFoundations.includes(ctx.foundation)) {
            throw new Error(`Test file does not support foundation ${ctx.foundation}`);
        }
        ctx.providers.forEach((a) => {
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