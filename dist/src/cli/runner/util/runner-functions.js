"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMochaTests = exports.executeRun = exports.testSuite = exports.newTestSuite = void 0;
const globalContext_1 = require("./globalContext");
function newTestSuite() {
    return 'Test complete!';
}
exports.newTestSuite = newTestSuite;
function testSuite({ id, title, testCases }) {
    describe(`🗃️  #${id} ${title}`, function () {
        const context = {};
        globalContext_1.MoonwallContext.getContext().providers.forEach((a) => {
            context[a.name] = a.api;
        });
        function testCase(id, title, callback) {
            it(`📁  #${id.concat(id)} ${title}`, callback);
        }
        testCases({ context, it: testCase });
    });
}
exports.testSuite = testSuite;
async function executeRun(ctx) {
    try {
        const result = await (0, exports.runMochaTests)();
        console.log(result);
        ctx.disconnect();
        process.exitCode = 0;
    }
    catch (e) {
        console.log(e);
        process.exitCode = 1;
    }
}
exports.executeRun = executeRun;
const runMochaTests = () => {
    return new Promise((resolve, reject) => {
        console.log('before actual run');
        mocha.run((failures) => {
            if (failures) {
                reject('🚧  At least one test failed, check report for more details.');
            }
            resolve('🎉  Test run has completed without errors.');
        });
    });
};
exports.runMochaTests = runMochaTests;
//# sourceMappingURL=runner-functions.js.map