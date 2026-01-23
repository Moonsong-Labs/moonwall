/**
 * Type augmentation for Polkadot.js Codec types
 * This provides common properties that are accessed in tests but aren't
 * properly typed by the api-augment package.
 */

import "@polkadot/types/types";

declare module "@polkadot/types/types" {
  interface Codec {
    // Account info
    data: {
      free: Codec;
      reserved: Codec;
      frozen: Codec;
    };

    // Version info
    specName: Codec;
    specVersion: Codec;

    // Block info
    current: Codec;
    normal: Codec;

    // Option methods
    isNone: boolean;
    isSome: boolean;
    unwrap(): Codec;

    // Array-like methods
    find(predicate: (value: unknown) => boolean): unknown;

    // Event properties
    section: string;
    method: string;

    // Numeric methods (from BN/BigInt types)
    // Accept BN via 'any' since BN type varies across versions
    sub(other: Codec | number | bigint | unknown): Codec;
    add(other: Codec | number | bigint | unknown): Codec;
    mul(other: Codec | number | bigint | unknown): Codec;
    div(other: Codec | number | bigint | unknown): Codec;
    lt(other: Codec | number | bigint | unknown): boolean;
    gt(other: Codec | number | bigint | unknown): boolean;
    eq(other: Codec | number | bigint | unknown): boolean;
    toNumber(): number;
    toBigInt(): bigint;

    // Weight/gas info
    refTime: Codec;
    proofSize: Codec;

    // Contract info
    codeHash: Codec;
  }
}
