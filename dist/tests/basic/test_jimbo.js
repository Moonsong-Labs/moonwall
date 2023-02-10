"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
describe('This is a jimbo test suite', function () {
    before(function () {
        console.log('this is test setup');
    });
    it('This is a bool test case', function () {
        (0, chai_1.expect)(true).to.be.true;
    });
    it('This is a number test case', function () {
        (0, chai_1.expect)(1332323221).to.be.greaterThan(1000000);
    });
    it('This is a string test case', function () {
        (0, chai_1.expect)('Home is where the bao is').to.contains('bao');
    });
    it('This is a error test case', function () {
        (0, chai_1.expect)(() => {
            throw new Error('ERROR THROWN');
        }).to.throw('ERROR');
    });
});
//# sourceMappingURL=test_jimbo.js.map