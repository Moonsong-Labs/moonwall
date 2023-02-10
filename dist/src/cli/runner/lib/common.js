"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getObjectMethods = exports.Percent = exports.Perbill = exports.sortObjectByKeys = void 0;
const util_1 = require("@polkadot/util");
function sortObjectByKeys(o) {
    return Object.keys(o)
        .sort()
        .reduce((r, k) => ((r[k] = o[k]), r), {});
}
exports.sortObjectByKeys = sortObjectByKeys;
class Perthing {
    constructor(unit, numerator, denominator) {
        if (!(numerator instanceof util_1.BN)) {
            numerator = new util_1.BN(numerator.toString());
        }
        if (denominator && !(denominator instanceof util_1.BN)) {
            denominator = new util_1.BN(denominator.toString());
        }
        this.unit = unit;
        if (denominator) {
            this.perthing = numerator.mul(unit).div(denominator);
        }
        else {
            this.perthing = numerator;
        }
    }
    value() {
        return this.perthing;
    }
    of(value) {
        return this.divNearest(this.perthing.mul(value), this.unit);
    }
    ofCeil(value) {
        return this.divCeil(this.perthing.mul(value), this.unit);
    }
    toString() {
        return `${this.perthing.toString()}`;
    }
    divCeil(a, num) {
        var dm = a.divmod(num);
        if (dm.mod.isZero())
            return dm.div;
        return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
    }
    divNearest(a, num) {
        var dm = a.divmod(num);
        if (dm.mod.isZero())
            return dm.div;
        var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;
        var half = num.ushrn(1);
        var r2 = num.andln(1);
        var cmp = mod.cmp(half);
        if (cmp <= 0 || (r2 === 1 && cmp === 0))
            return dm.div;
        return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
    }
}
class Perbill extends Perthing {
    constructor(numerator, denominator) {
        super(new util_1.BN(1000000000), numerator, denominator);
    }
}
exports.Perbill = Perbill;
class Percent extends Perthing {
    constructor(numerator, denominator) {
        super(new util_1.BN(100), numerator, denominator);
    }
}
exports.Percent = Percent;
function getObjectMethods(obj) {
    let properties = new Set();
    let currentObj = obj;
    do {
        Object.getOwnPropertyNames(currentObj).map((item) => properties.add(item));
    } while ((currentObj = Object.getPrototypeOf(currentObj)));
    return [...properties.keys()].filter((item) => typeof obj[item] === "function");
}
exports.getObjectMethods = getObjectMethods;
//# sourceMappingURL=common.js.map