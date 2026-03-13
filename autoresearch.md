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
- Current best known result: **21.187120s** at commit `69b75ef`.
- Kept wins:
  - Reworked `dev_multi` to use an explicit **polkadotJs-only** connection set and fixed `createDevBlock()` so it no longer requires a viem provider just to detect whether one exists.
  - Switched `dev_multi` from Vitest `forks` to **`threads` with `isolate: true`**.
  - Worker tuning evolved over time: early optimizations made **8 workers** best, and after deeper import-graph slimming the new best became **9 workers**.
  - Removed the **HTML reporter** from the hot path; `dev_multi` now only pays for the basic reporter.
  - Set `POLKADOTJS_DISABLE_ESM_CJS_WARNING=1` for `dev_multi`, which reduced repeated warning overhead.
  - Added **binary fingerprint caching** in `StartupCacheService`, so isolated workers stop re-hashing the ~148MB moonbeam binary on every launch.
  - Expanded `cacheImports` optimizer includes with the heavy packages actually touched by `dev_multi` workers (`ethers`, `web3`, websocket stack, key polkadot packages, Moonbeam augment).
  - Lazy-loaded unused provider runtimes in `providerFactories` so polkadotJs-only workers no longer eagerly import `web3`, `ethers`, `viem`, or `polkadot-api` client extras.
  - Slimmed the hot import graph further by removing eager `zombienet`, `dockerode`, and `util/index` barrel loads from the core dev path.
  - Split `foundations/dev` imports so contract helpers, raw transaction helpers, and jumping helpers are loaded only if a test actually calls them.
  - Slimmed the remaining root import graph further by lazy-loading the legacy `localNode` path, making `contractFunctions` lightweight, and replacing additional hot `util/index` imports in governance/RPC/startup helpers.
  - Reworked node launch readiness so the fast path now **captures the JSON-RPC port directly from node stdout** and only falls back to the old lsof-based discovery when no hint arrives.
  - Removed polling from that new fast path by resolving a **promise directly from process output** when the RPC-port log line appears.
  - Lazy-loaded the old **RpcPortDiscoveryService** only on fallback, so the normal stdout-hint path avoids importing the heavier lsof/socket discovery stack up front.
  - Slimmed the public test-helper import path by **lazy-loading `ethers`, `viem`, and `ws` inside rarely used helper functions** in `src/api/testing`, so importing `moonwall` for simple dev tests no longer eagerly pulls those runtimes.
  - Made `src/api/testing/blocks.ts` lighter on the root import path by **lazy-loading `Bottleneck` only when `getBlockArray()` actually runs**.
  - Removed another unused import-time cost from `src/api/testing/blocks.ts` by **deferring creation of the `test:blocks` logger until the block-history helper is actually called**.
- Discarded / dead ends:
  - `maxWorkers=8` and `maxWorkers=10` both regressed after the latest import-graph wins; **9 workers** remains the current sweet spot.
  - `vmThreads` crashed with file-level startup errors for this workload.
  - Disabling `cacheImports` regressed badly.
  - A known-RPC-port fast path in `RpcPortDiscoveryService` regressed versus the existing lsof-based discovery path.
  - Switching process cleanup to `SIGKILL`, or trying to overlap provider disconnects with node cleanup, both regressed versus the current teardown path.
  - Expanding optimizer includes too aggressively (deeper polkadot transitive packages or smaller utility packages like `chalk`/`bottleneck`) gave little or negative return; prebundling `effect` / `@effect/platform*` outright crashed startup.
  - Naive dependency-tree surgery via global `pnpm.overrides` that forced the `@polkadot` util/keyring family to `13.5.6` did dedupe the tree, but it **regressed badly** on the benchmark.
  - Setting the polkadot warning env var earlier in `src/cli.ts` or `src/index.ts` did not beat the current approach, and earlier `console.warn` suppression in `cli/internal/logging.ts` also regressed.
  - Small root-export / barrel experiments regressed: lighter `contractFunctions`/`rpcFunctions` wrappers before the later keep, lazy `util/functions` wrappers, a curated root facade replacing `util/index`, lazy governance wrappers, lazy `Web3` export, and making the api-base events augmentation import type-only.
  - Switching the benchmark reporter from `basic` to `dot` regressed.
  - Replacing `Keyring` imports with `@polkadot/keyring` did not beat the current best.
  - Lazy-loading `Bottleneck` in `runnerContext` regressed.
  - Lazy-importing `globalContext` from `runnerContext` or `runTests` regressed.
  - Slimming unused zombie/chopsticks handlers with extra lazy imports regressed, and moving zombie IPC/startup/cleanup into a lazy helper module also lost on re-run.
  - Lazily importing chopsticks launch code in `globalContext` and lazily importing auxiliary CLI entrypoint commands both regressed.
  - Lazy-loading `configReader`/`providerFactories` inside `rpcFunctions`, lazy-loading `@polkadot/util-crypto` inside `governanceProcedures`, and making `src/api/types/index.ts` mostly type-only all regressed.
  - Lazily creating the unused `ed25519` / `sr25519` keyrings in `accounts.ts` did not beat the current best.
  - Re-testing the pre-`ee7d565` static `RpcPortDiscoveryService` import path on top of the latest code lost to HEAD, so the older `79c932d` measurement should be treated as an outlier rather than a rollback target.
  - Caching a seeded `--base-path` and cloning it per isolated file removed the explicit genesis rebuild step, but cloned ParityDB startups were still slower than fresh `--tmp` starts.
  - Disabling node stdout/stderr capture regressed.
  - Adding `--in-peers=0` / `--out-peers=0` to the default moonbeam dev args regressed.
  - Caching the selected config/env on `MoonwallContext` and bypassing the `runNetworkOnly()` indirection did not beat the current best.
- Structural takeaway:
  - The biggest wins so far came from reducing **per-worker fixed overhead** (fewer provider types, less eager loading, better import optimization, better startup-cache bookkeeping) and from reducing the number of **startup waves** across 13 isolated files.
  - Small piecemeal lazy-wrapper experiments often look promising but have repeatedly lost to simpler static code — however, **module-local lazy runtime imports in clearly unused root helper modules are still paying off**.
  - A naive **clone-the-initialized-base-path** snapshot approach is not enough by itself: even without a fresh genesis rebuild, cloned ParityDB startups came in slower than the current `--tmp` path.
  - The old lsof-based port-discovery path is no longer the normal hot path; the current best launches now win by treating **node stdout as the primary readiness hint** and using lsof only as a fallback.
  - The public `moonwall` test-consumer entry is still a major lever: broad root/helper re-exports can quietly force eager loads of large runtimes even when a suite only needs `describeSuite`, `expect`, and dev accounts.
  - The next meaningful jump probably needs either more targeted dependency-tree surgery than the failed global overrides, or further public-entry slimming that keeps unused helper runtimes off the default test path.
