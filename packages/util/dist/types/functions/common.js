import "@moonbeam-network/api-augment";
import { BN } from "@polkadot/util";
// Sort dict by key
export function sortObjectByKeys(obj) {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = obj[key];
  }
  return sortedObj;
}
// Perthings arithmetic conformant type.
class Perthing {
  unit;
  perthing;
  constructor(unit, num, denom) {
    let numerator = num;
    let denominator = denom;
    if (!(numerator instanceof BN)) {
      numerator = new BN(numerator.toString());
    }
    if (denominator && !(denominator instanceof BN)) {
      denominator = new BN(denominator.toString());
    }
    this.unit = unit;
    if (denominator) {
      this.perthing = numerator.mul(unit).div(denominator);
    } else {
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
    const dm = a.divmod(num);
    // Fast case - exact division
    if (dm.mod.isZero()) return dm.div;
    // Round up
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  }
  divNearest(a, num) {
    const dm = a.divmod(num);
    // Fast case - exact division
    if (dm.mod.isZero()) return dm.div;
    const mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;
    const half = num.ushrn(1);
    const r2 = num.andln(1);
    const cmp = mod.cmp(half);
    // Round down
    if (cmp <= 0 || (r2 === new BN(1) && cmp === 0)) return dm.div;
    // Round up
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  }
}
// Perthings arithmetic conformant type representing part(s) per billion.
export class Perbill extends Perthing {
  constructor(numerator, denominator) {
    super(new BN(1_000_000_000), numerator, denominator);
  }
}
// Perthings arithmetic conformant type representing part(s) per cent.
export class Percent extends Perthing {
  constructor(numerator, denominator) {
    super(new BN(100), numerator, denominator);
  }
}
export function getObjectMethods(obj) {
  const properties = new Set();
  let currentObj = obj;
  while (currentObj) {
    for (const item of Object.getOwnPropertyNames(currentObj)) {
      properties.add(item);
    }
    currentObj = Object.getPrototypeOf(currentObj);
  }
  return Array.from(properties).filter((item) => typeof obj[item] === "function");
}
export async function directRpcRequest(
  endpoint,
  method,
  params = [],
  timeoutMs = 10000 // Default 10 second timeout
) {
  const data = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };
  if (endpoint.startsWith("ws")) {
    console.log("you've passed a websocket to fetch, is this intended?");
  }
  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const responseData = await response.json();
    if (responseData.error) {
      throw new Error(responseData.error.message);
    }
    return responseData.result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(
        `RPC request to ${endpoint} timed out after ${timeoutMs}ms (method: ${method})`
      );
    }
    throw error;
  }
}
//# sourceMappingURL=common.js.map
