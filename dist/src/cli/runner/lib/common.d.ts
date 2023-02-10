/// <reference types="bn.js" />
import { BN } from "@polkadot/util";
export declare function sortObjectByKeys(o: any): {};
declare class Perthing {
    private unit;
    private perthing;
    constructor(unit: BN, numerator: BN | number, denominator?: BN | number);
    value(): BN;
    of(value: BN): BN;
    ofCeil(value: BN): BN;
    toString(): string;
    divCeil(a: any, num: BN): any;
    divNearest(a: any, num: BN): any;
}
export declare class Perbill extends Perthing {
    constructor(numerator: BN | number, denominator?: BN | number);
}
export declare class Percent extends Perthing {
    constructor(numerator: BN | number, denominator?: BN | number);
}
export declare function getObjectMethods(obj: any): unknown[];
export {};
