import { expect } from "chai";
import { testSuite } from "../../src/cli/runner/util/runner-functions.js";
import { createBlock } from "../../src/utils/contextHelpers.js";
import { FoundationType } from "../../src/cli/runner/lib/types.js";
import { ALITH_ADDRESS } from "../../src/cli/runner/lib/accounts.js";
testSuite({
    id: "S100",
    title: "Testing for compile time errors",
    supportedFoundations: [FoundationType.DevMode],
    testCases: ({ it, context }) => {
        const api = context.getWeb3();
        const mbApi = context.getMoonbeam();
        it("E01", "Calling chain data", async function () {
            console.log(`The latest block is ${(await api.eth.getBlock("latest")).number}`);
            const bal = Number(await api.eth.getBalance(ALITH_ADDRESS));
            expect(bal).to.be.greaterThan(0);
        });
        it("E02", "Create block", async function () {
            await createBlock(api, mbApi);
        });
    },
});
//# sourceMappingURL=compile_errors.js.map