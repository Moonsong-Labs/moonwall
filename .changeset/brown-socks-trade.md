---
"@moonwall/types": patch
"@moonwall/cli": patch
---

Tanssi upgrades

- Upgrading the artifact downloader to work for tanssi's non-semver release names
- Added new context properties for `dev`` foundations
  - `pjsApi`: Default getter for PolkadotJs ApiPromise
  - `isEthereumChain` : Getter for whether chain is AccountId20 or not
  - `isSubstrateChain` : Default getter for whether chain is AccountId32 or not
  - `keyring`: Returns an object containing the default accounts (alice, bob)
