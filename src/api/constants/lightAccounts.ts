// Lightweight account constants for startup-sensitive paths.
// Avoid importing accounts.ts here because it eagerly constructs Keyring pairs
// and pulls in heavy polkadot-js crypto initialization.

export const ALITH_ADDRESS: `0x${string}` = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac";
export const ALITH_PRIVATE_KEY: `0x${string}` =
  "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133";
