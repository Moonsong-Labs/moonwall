---
"@moonwall/types": minor
"@moonwall/cli": minor
"@moonwall/tests": minor
---

## Performance: Caching Improvements

- Add startup cache option for dev nodes (precompiled WASM + raw chainspec, shared metadata cache).
- Add `cacheImports` flag to prebundle viem/ethers in Vitest.
- Speed up readiness/port discovery and tweak moonbeam dev defaults (paritydb, env HTTP endpoint).
