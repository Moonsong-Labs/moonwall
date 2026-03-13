#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Fast sanity check for hot TypeScript modules before the slower benchmark path.
pnpm exec tsx --eval "(async () => { await Promise.all([
  import('./src/cli/cmds/runTests.ts'),
  import('./src/cli/lib/globalContext.ts'),
  import('./src/cli/lib/runnerContext.ts'),
  import('./src/cli/internal/commandParsers.ts'),
  import('./src/cli/internal/providerFactories.ts'),
]); })()" >/dev/null

# Ensure the benchmark exercises the current CLI build.
pnpm build >/dev/null

start_ns="$(python - <<'PY'
import time
print(time.perf_counter_ns())
PY
)"

bench_log="$(mktemp -t moonwall-dev-multi.XXXXXX.log)"

set +e
(
  cd test
  pnpm moonwall test dev_multi
) >"$bench_log" 2>&1
status=$?
set -e

end_ns="$(python - <<'PY'
import time
print(time.perf_counter_ns())
PY
)"

tail -n 60 "$bench_log"

python - "$start_ns" "$end_ns" <<'PY'
import sys
start_ns = int(sys.argv[1])
end_ns = int(sys.argv[2])
print(f"METRIC total_s={(end_ns - start_ns)/1e9:.6f}")
PY

rm -f "$bench_log"
exit "$status"
