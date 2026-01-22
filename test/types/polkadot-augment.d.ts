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
  }
}
