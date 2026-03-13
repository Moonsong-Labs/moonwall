#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

pnpm -s exec tsx -e "void (async () => { await import('./src/cli/lib/globalContext.ts'); await import('./src/cli/internal/node.ts'); await import('./src/services/process/launchNodeEffect.ts'); })();" >/dev/null

if [[ ! -f dist/cli.js ]] || find src package.json -type f -newer dist/cli.js -print -quit | grep -q .; then
  pnpm -s exec zshy >/dev/null
fi

tmp_output=$(mktemp)
cleanup() {
  rm -f "$tmp_output"
}
trap cleanup EXIT

start=$(python - <<'PY'
import time
print(time.time())
PY
)

set +e
(
  cd test
  pnpm exec moonwall test papi_dev
) 2>&1 | tee "$tmp_output"
cmd_status=${PIPESTATUS[0]}
set -e

end=$(python - <<'PY'
import time
print(time.time())
PY
)

duration=$(python - <<PY
start = float("$start")
end = float("$end")
print(f"{end - start:.3f}")
PY
)

if [[ $cmd_status -ne 0 ]]; then
  echo "METRIC wall_clock_s=0"
  echo "METRIC benchmark_pass=0"
  exit $cmd_status
fi

if grep -Eq "(All tests passed|passed \()" "$tmp_output"; then
  pass=1
else
  pass=0
fi

echo "METRIC wall_clock_s=$duration"
echo "METRIC benchmark_pass=$pass"

if [[ $pass -ne 1 ]]; then
  exit 1
fi
