"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
describe('This is a timbo test suite', function () {
    before(function () {
        console.log('this is test setup');
    });
    it('This is a bool test case', function () {
        (0, chai_1.expect)(true).to.be.true;
    });
    it('This is a failing number test case', function () {
        (0, chai_1.expect)(1332323221).to.be.lessThan(1000000);
    });
    it('This is a string test case', function () {
        (0, chai_1.expect)('Home is where the bao is').to.contains('bao');
    });
    it('This is a failing error test case', function () {
        (0, chai_1.expect)(() => {
            throw new Error('ERROR THROWN');
        }).to.throw('wadwada');
    });
});
//# sourceMappingURL=test_basic.js.map