# Autoresearch: dev_multi startup + teardown time

## Objective
Make `pnpm moonwall test dev_multi` as fast as possible, with emphasis on reducing fixed startup and teardown overhead while preserving strong state separation for the `dev_multi` workload.

The current workload is the `test` workspace environment `dev_multi`, which runs the `test/suites/test_separation` suite set. Each file expects fresh chain state at file start and preserved state within the file.

## Metrics
- **Primary**: `total_s` (s, lower is better)
- **Secondary**: benchmark pass/fail, architectural simplicity, state-separation fidelity

## How to Run
`./autoresearch.sh` — pre-checks hot modules, rebuilds `dist`, runs `cd test && pnpm moonwall test dev_multi`, and prints `METRIC total_s=<seconds>`.

## Files in Scope
- `src/cli/cmds/runTests.ts` — Vitest option construction and threading/isolation behavior
- `src/cli/lib/globalContext.ts` — node startup, provider connection, teardown, lifecycle reuse
- `src/cli/lib/runnerContext.ts` — per-file beforeAll/afterAll context semantics
- `src/cli/internal/commandParsers.ts` — dev-node launch command shaping and startup caching
- `src/cli/internal/node.ts` — node launch + readiness wiring
- `src/cli/internal/providerFactories.ts` — default provider set and provider connection cost
- `src/services/process/launchNodeEffect.ts` — effect-based node launch path
- `src/services/network/RpcPortDiscoveryService.ts` — RPC readiness/port discovery overhead
- `test/moonwall.config.json` — `dev_multi` benchmark environment
- `autoresearch.sh` / `autoresearch.md` — experiment harness and notes

## Off Limits
- Changing the semantic requirement that each `dev_multi` test file starts from clean chain state
- Weakening correctness checks just to make the benchmark faster
- Adding new dependencies
- Editing unrelated test suites to game the benchmark

## Constraints
- `cd test && pnpm moonwall test dev_multi` must still pass
- Keep file-level state separation strong
- Prefer simpler changes when performance is similar
- Measure the real CLI path, not a synthetic microbenchmark only

## What's Been Tried
- Initial code reading completed.
- Important workload insight: `test/suites/test_separation` contains **13** files, not 5. Startup/teardown happens in many waves if worker concurrency is low.
- Current best known result: **26.134106s** at commit `7ec8fd1`.
- Kept wins:
  - Reworked `dev_multi` to use an explicit **polkadotJs-only** connection set and fixed `createDevBlock()` so it no longer requires a viem provider just to detect whether one exists.
  - Switched `dev_multi` from Vitest `forks` to **`threads` with `isolate: true`**.
  - Increased `dev_multi` worker count to **8**, which matches the 13-file workload much better than the old 3-worker default.
  - Removed the **HTML reporter** from the hot path; `dev_multi` now only pays for the basic reporter.
  - Set `POLKADOTJS_DISABLE_ESM_CJS_WARNING=1` for `dev_multi`, which reduced repeated warning overhead.
  - Added **binary fingerprint caching** in `StartupCacheService`, so isolated workers stop re-hashing the ~148MB moonbeam binary on every launch.
  - Expanded `cacheImports` optimizer includes with the heavy packages actually touched by `dev_multi` workers (`ethers`, `web3`, websocket stack, key polkadot packages, Moonbeam augment).
- Discarded / dead ends:
  - `maxWorkers=9` and `maxWorkers=10` both lost to 8 workers once contention was factored in.
  - Disabling `cacheImports` regressed badly.
  - A known-RPC-port fast path in `RpcPortDiscoveryService` regressed versus the existing lsof-based discovery path.
  - Switching process cleanup to `SIGKILL` regressed versus the current graceful `SIGTERM` path.
  - Expanding optimizer includes too aggressively into deeper polkadot transitive packages gave little or negative return.
  - Setting the polkadot warning env var earlier in `src/cli.ts` did not beat the environment-scoped approach.
- Structural takeaway:
  - The biggest wins so far came from reducing **per-worker fixed overhead** (fewer provider types, better import optimization, better startup-cache bookkeeping) and from reducing the number of **startup waves** across 13 isolated files.
