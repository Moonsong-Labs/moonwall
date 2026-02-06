import { BN } from "@polkadot/util";

// Perthings arithmetic conformant type. Matches Substrate's sp_runtime fixed-point types.
// Uses exact integer arithmetic throughout — no floating point.
class Perthing {
  private readonly unit: BN;
  private readonly unitBigInt: bigint;
  private readonly perthing: BN;

  constructor(unit: BN, numerator: BN | number | bigint, denominator?: BN | number | bigint) {
    this.unit = unit;
    this.unitBigInt = BigInt(unit.toString());

    const num = numerator instanceof BN ? numerator : new BN(numerator.toString());

    if (denominator !== undefined) {
      const denom = denominator instanceof BN ? denominator : new BN(denominator.toString());
      this.perthing = num.mul(unit).div(denom);
    } else {
      this.perthing = num;
    }
  }

  value(): BN {
    return this.perthing;
  }

  of(amount: BN): BN;
  of(amount: bigint): bigint;
  of(amount: BN | bigint): BN | bigint {
    if (amount instanceof BN) {
      return this.divNearest(this.perthing.mul(amount), this.unit);
    }
    return this.divNearestBigInt(amount * BigInt(this.perthing.toString()), this.unitBigInt);
  }

  ofCeil(amount: BN): BN;
  ofCeil(amount: bigint): bigint;
  ofCeil(amount: BN | bigint): BN | bigint {
    if (amount instanceof BN) {
      return this.divCeil(this.perthing.mul(amount), this.unit);
    }
    return this.divCeilBigInt(amount * BigInt(this.perthing.toString()), this.unitBigInt);
  }

  toString(): string {
    return this.perthing.toString();
  }

  private divNearest(a: BN, num: BN): BN {
    const dm = a.divmod(num);
    if (dm.mod.isZero()) return dm.div;
    const half = num.ushrn(1);
    return dm.mod.gt(half) ? dm.div.addn(1) : dm.div;
  }

  private divCeil(a: BN, num: BN): BN {
    const dm = a.divmod(num);
    if (dm.mod.isZero()) return dm.div;
    return dm.div.addn(1);
  }

  private divNearestBigInt(a: bigint, unit: bigint): bigint {
    const div = a / unit;
    const mod = a % unit;
    if (mod === 0n) return div;
    return mod > unit >> 1n ? div + 1n : div;
  }

  private divCeilBigInt(a: bigint, unit: bigint): bigint {
    const div = a / unit;
    const mod = a % unit;
    if (mod === 0n) return div;
    return div + 1n;
  }
}

// Parts per billion (0 – 1,000,000,000). 1e9 = 100%.
export class Perbill extends Perthing {
  constructor(numerator: BN | number | bigint, denominator?: BN | number | bigint) {
    super(new BN(1_000_000_000), numerator, denominator);
  }
}

// Parts per cent (0 – 100). 100 = 100%.
export class Percent extends Perthing {
  constructor(numerator: BN | number | bigint, denominator?: BN | number | bigint) {
    super(new BN(100), numerator, denominator);
  }
}
