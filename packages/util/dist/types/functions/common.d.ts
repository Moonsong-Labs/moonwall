import "@moonbeam-network/api-augment";
import { BN } from "@polkadot/util";
export declare function sortObjectByKeys(obj: Record<string, any>): Record<string, any>;
declare class Perthing {
  private unit;
  private perthing;
  constructor(unit: BN, num: BN | number, denom?: BN | number);
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
export declare function getObjectMethods(obj: any): string[];
export declare function directRpcRequest(
  endpoint: string,
  method: string,
  params?: any[],
  timeoutMs?: number
): Promise<any>;
export {};
