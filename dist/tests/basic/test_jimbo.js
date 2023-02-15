import { expect, beforeAll } from 'vitest';
describe('This is a jimbo test suite', function () {
    beforeAll(function () {
        console.log('this is test setup');
    });
    it('This is a bool test case', function () {
        expect(true).to.be.true;
    });
    it('This is a number test case', function () {
        expect(1332323221).to.be.greaterThan(1000000);
    });
    it('This is a string test case', function () {
        expect('Home is where the bao is').to.contains('bao');
    });
    it('This is a error test case', function () {
        expect(() => {
            throw new Error('ERROR THROWN');
        }).to.throw('ERROR');
    });
});
//# sourceMappingURL=test_jimbo.js.map