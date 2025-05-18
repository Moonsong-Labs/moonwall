# Running Moonwall in CI

Moonwall is built with **deterministic, headless execution** in mind – you can drop it into any CI platform that supports Node 20 (GitHub Actions, GitLab, CircleCI, …).  This guide shows common patterns and recommended flags.

---

## 1 – Base image / environment

* **Node 20** or newer – required for `fetch` and other built-ins.
* **Docker** (only when you use the **zombie** foundation).
* **pnpm** – we recommend installing via `corepack enable && corepack prepare pnpm@latest --activate`.

Example GitHub runner:

```yaml
runs-on: ubuntu-latest
container: node:20-bullseye
```

---

## 2 – Caching dependencies & artifacts

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: 'pnpm'

  - name: Install deps (with frozen lockfile)
    run: pnpm i --frozen-lockfile

  - name: Cache downloaded binaries
    uses: actions/cache@v4
    with:
      path: |
        ~/.cache/moonwall     # artifact downloader stores files here
      key: moonwall-bins-${{ hashFiles('**/moonwall.config.json') }}
```

Moonwall itself does **not** need to be built – `pnpm i` pulls the compiled packages from npm.

---

## 3 – Parallelisation strategies

### A. Matrix by **environment**

```yaml
strategy:
  matrix:
    ENV: [devnet, chop_fork, moonbase]

steps:
  - run: pnpm moonwall test ${{ matrix.ENV }}
```

Each job spins up exactly one network → the longest part (node boot) is parallelised.

### B. Matrix by **test shard**

If you have thousands of tests against a single environment use the built-in sharding flag:

```yaml
strategy:
  matrix:
    SHARD: ["1/4", "2/4", "3/4", "4/4"]

steps:
  - run: pnpm moonwall test devnet --testShard ${{ matrix.SHARD }}
```

Because sharding is implemented *before* Vitest is launched it works with snapshot tests as well.

---

## 4 – Non-interactive mode & timeouts

CI shells are non-TTY so the interactive prompts are automatically **suppressed**.  Nevertheless it is good practice to add a timeout around Moonwall:

```bash
npx --yes timeout-cli -t 25m -- pnpm moonwall test devnet
```

`timeout-cli` will send `SIGTERM` if the process hangs indefinitely (burnt node, test dead-lock, …).

---

## 5 – Partial reruns

When a flaky test fails you might want to rerun *only* the failed group.  Save the Vitest JSON report and feed it back via `--GrepTest`:

```bash
FAILS=$(jq -r '.testResults[] | select(.status=="failed") | .name' results.json | paste -sd "|" -)

pnpm moonwall test devnet "$FAILS"
```

---

## 6 – Gotchas

| Symptom | Fix |
|---------|-----|
| "ERR_SOCKET hung up" after 5 min | Increase `startupTimeout` of your foundation or ensure ports are exposed. |
| “Cannot connect to wss:// …” | CI firewall may block WS – switch to `ws://localhost` endpoints by starting the node inside the same container. |
| Snapshots differ only in timestamps | Use `expect(date).toMatchInlineSnapshot("<timestamp>")` or mock time. |

---

Happy green pipelines! ✅
