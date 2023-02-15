import { describe, it } from "vitest";
import { MoonwallContext } from "../../../../src/index.js";
import { ProviderType } from "../lib/types";
export function testSuite({ id, title, testCases, supportedFoundations, }) {
    console.log("hello timbo");
    const ctx = MoonwallContext.getContext();
    describe(`🗃️  #${id} ${title}`, function () {
        let context = {
            providers: {},
            getPolkadotJs: (apiName) => {
                if (apiName) {
                    return context.providers[apiName];
                }
                else {
                    return MoonwallContext.getContext().providers.find((a) => a.type == ProviderType.PolkadotJs).api;
                }
            },
            getMoonbeam: (apiName) => {
                if (apiName) {
                    return context.providers[apiName];
                }
                else {
                    return MoonwallContext.getContext().providers.find((a) => a.type == ProviderType.Moonbeam).api;
                }
            },
            getEthers: (apiName) => {
                if (apiName) {
                    return context.providers[apiName];
                }
                else {
                    return MoonwallContext.getContext().providers.find((a) => a.type == ProviderType.Ethers).api;
                }
            },
            getWeb3: (apiName) => {
                if (apiName) {
                    return context.providers[apiName];
                }
                else {
                    return MoonwallContext.getContext().providers.find((a) => a.type == ProviderType.Web3).api;
                }
            },
        };
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
//# sourceMappingURL=runner-functions.js.map