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
- Observed architecture:
  - `dev_multi` currently sets `multiThreads: true`, which maps to Vitest file parallelism with `pool: "forks"`, `isolate: true`, and `maxWorkers: 3`.
  - `describeSuite()` creates a `MoonwallContext` in `beforeAll()` and destroys it in `afterAll()` for every test file.
  - For `dev` foundations, that likely means each isolated test file pays full node startup, provider connection, and teardown cost.
  - `cacheStartupArtifacts: true` is already enabled, so the next wins are likely lifecycle reuse, lighter provider setup, or cheaper readiness/teardown.
