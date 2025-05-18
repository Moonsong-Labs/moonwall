# `moonwall test` – Automated Test Runner

`moonwall test` is the **non-interactive** counterpart to [`run`](./run).  
It spawns (or re-uses) the network, runs your Vitest suites and propagates the exit code back to the OS – perfect for CI.

---

## 1 – Syntax

```bash
pnpm moonwall test <envName> [GrepTest] [options]

# examples
pnpm moonwall test devnet               # run all suites
pnpm moonwall test devnet "ET-42"       # run only the test with ID ET-42
pnpm moonwall test devnet --update      # update snapshots
```

### Positional arguments

| Name       | Description |
|------------|-------------|
| `envName`  | Name of the environment in the Moonwall config. Can be *arrayed* to run **multiple** environments one after another: `moonwall test devnet stagnet`. |
| `GrepTest` | Optional Vitest grep expression (ID or title). |

### Options

| Flag                             | Alias | Description |
|----------------------------------|-------|-------------|
| `--subDirectory <dir>`           | `-d`  | Only look for suites inside this directory. |
| `--testShard <n/total>`          | `-ts` | Run a *slice* of the suite list – useful to parallelise CI. Example: `--testShard 2/5` means “2nd shard out of 5”. |
| `--update`                       | `-u`  | Forward `--update` to Vitest → update all snapshots. |
| `--vitestArgPassthrough "…"`    | `--vitest` | Append raw flags to Vitest. Surround with quotes. |
| `--configFile <path>`            | `-c`  | Alternative config file. |

---

## 2 – Exit codes

| Code | Meaning |
|------|---------|
| **0**| All tests passed, no network errors. |
| **1**| At least one test failed *or* a network/foundation error occured. |

Moonwall propagates Vitest’s error code so your CI pipelines can fail fast.

---

## 3 – Sharding strategy for CI

The `--testShard` flag accepts the same format as Vitest upstream: `index/total` (1-based).  
Moonwall will:

1. Enumerate all suites (after the optional `--subDirectory` filter).
2. Split the list into *total* groups with **round-robin** assignment.
3. Run only the group at *index*.

That means if you have 100 suites and run `--testShard 1/4` each shard runs **25 suites** (assuming an even distribution).

---

## 4 – Re-using an existing network in CI

Sometimes another job has already booted the chain (e.g. to save 2-3 minutes startup time).  In that case set the environment variable:

```bash
MOONWALL_ASSUME_RUNNING=true pnpm moonwall test devnet
```

Moonwall will skip the *Kill / Continue / Abort* prompt and directly attach to the running processes.  Make sure the ports match your config!

---

### Related docs

* [CI guide](/guide/test/ci)
* [Running tests quick-start](/guide/test/quick-start)
