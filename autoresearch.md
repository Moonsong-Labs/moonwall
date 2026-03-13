# Autoresearch: reduce test execution time from faster node startup

## Objective
Reduce end-to-end test runtime for Moonwall dev-environment tests by improving how Moonwall spins up local nodes and connects test providers.

Current benchmark workload is the smallest real dev-backed test command in this repo that still exercises node launch, provider connection, and teardown:

`cd test && pnpm exec moonwall test papi_dev`

This workload starts a local Moonbeam dev node, waits for it to become reachable, connects the PAPI client, runs the `test/suites/papi/dev.test.ts` suite, and tears everything down.

## Metrics
- **Primary**: wall_clock_s (s, lower is better)
- **Secondary**: benchmark_pass, startup-path simplicity, provider connection reliability

## How to Run
`./autoresearch.sh` — runs a fast import/syntax precheck, then the benchmark, and prints `METRIC name=value` lines.

## Files in Scope
- `src/cli/lib/globalContext.ts` — orchestration for starting networks and connecting providers
- `src/cli/internal/node.ts` — non-legacy node launch path and env wiring
- `src/services/process/launchNodeEffect.ts` — effect-based node launch and RPC-port discovery path
- `src/services/network/RpcPortDiscoveryService.ts` — port discovery and RPC probing
- `src/services/network/NodeReadinessService.ts` — readiness probing helpers
- `src/cli/internal/providerFactories.ts` — provider connection setup and metadata caching
- `src/services/process/ProcessManagerService.ts` — child-process lifecycle and cleanup
- `autoresearch.sh` — benchmark harness
- `autoresearch.md` — experiment state and findings

## Off Limits
- Public API behavior unrelated to node startup
- Test semantics and assertions in `test/suites/**`
- Adding new dependencies
- Docker/zombie/chopsticks behavior unless a shared improvement clearly helps this benchmark without regressions

## Constraints
- The benchmark command must keep passing.
- No new dependencies.
- Prefer simpler launch logic when performance is equal.
- Changes should preserve correctness for both fixed RPC ports and dynamically assigned ports.
- Avoid changes that only optimize logs or reporting while leaving node startup unchanged.

## What's Been Tried
- Baseline harness initially crashed because the `tsx -e` precheck used top-level await; fixed by wrapping imports in an async IIFE.
- Baseline pass for `cd test && pnpm exec moonwall test papi_dev`: **15.6s**.
- Methodology correction: `pnpm exec moonwall` runs `dist/cli.js`, so source edits were only exercised after rebuilding the CLI. `autoresearch.sh` now refreshes `dist/` with `pnpm exec zshy` outside the timed window whenever `src/**` or `package.json` is newer than `dist/cli.js`.
- Corrected current-source baseline after syncing `dist/` with the already-kept startup changes is about **11.0s**.
- Kept improvement: `src/services/process/launchNodeEffect.ts` now skips lsof-based RPC-port discovery when `--rpc-port` is already explicit in the final node args, and instead waits for readiness directly on that known port. First passing result after this change: **14.5s** in the original harness; after the dist-sync correction, the current codepath benchmarks around **11.0s**.
- Kept improvement: `src/cli/internal/commandParsers.ts` now opportunistically reuses an already-warm startup cache for local dev nodes even when `cacheStartupArtifacts` is not explicitly enabled. First passing result after this change: **14.2s** in the original harness; after the dist-sync correction, the current codepath benchmarks around **11.0s**.
- Architectural insight: `LaunchCommandParser.withPorts()` already pre-allocates or injects a stable RPC port for many dev launches, so paying the extra `lsof` + candidate-port probing cost in `launchNodeEffect()` is often redundant.
- Profiling snapshot for `papi_dev` showed `startNetwork()` dominates (~3.1s) while `connectEnvironment()` is tiny (~6ms), so provider connection work is not the main bottleneck for this workload.
- Fresh debug trace on the corrected harness shows Moonwall is now using both the cached precompiled WASM directory and raw chain spec, yet the Moonbeam process still needs roughly **3.1s** from spawn to first successful `system_chain` response.
- Dead end: starting dev/chopsticks network warmup in the background during Vitest bootstrap did not improve `papi_dev`; likely not enough useful overlap with this workload.
- Dead end: more aggressive readiness timeouts did not improve runtime and would only add flakiness risk.
- Dead end: tweaking obvious Moonbeam default args (`--database=paritydb`, `--reserved-only`, dropping `--unsafe-force-node-key-generation` after raw-spec substitution) did not help this benchmark.
- Dead end: a simple mtime-based heuristic for detecting warm startup cache was slightly worse than the current implementation.
- Dead end: a persistent startup-cache fingerprint/index (verified stat metadata + saved hash) added complexity without a convincing win, so it was discarded.
- Remaining likely opportunities: investigate why Moonbeam still takes ~3.1s to answer RPC even with warm raw-spec/precompiled artifacts, and validate which cached-artifact flags materially reduce real node boot time versus just Moonwall-side setup overhead.
