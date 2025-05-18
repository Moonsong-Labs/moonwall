# `moonwall run` – Network Launcher & Toolbox

`moonwall run` starts the **network only** – it does *not* run Vitest automatically.  
This is extremely handy when you want to:

* Tail node logs while developing a pallet.
* Manually play with RPC endpoints (Polkadot‐JS Apps, HardHat console, …).
* Run **interactive tests** one by one inside the Toolbox.

---

## 1 – Syntax

```bash
pnpm moonwall run <envName> [GrepTest] [options]

# example
pnpm moonwall run devnet
```

### Positional arguments

| Name         | Description |
|--------------|-------------|
| `envName`    | Name of the environment in `moonwall.config.json`. |
| `GrepTest`   | Optional **test ID / title pattern** – immediately executes matching tests *after* the network is up. |

### Options

| Flag                  | Alias | Default | Description |
|-----------------------|-------|---------|-------------|
| `--subDirectory <dir>`| `-d`  | _none_  | Further limit the suites searched for the Grep pattern. |
| `--configFile <path>` | `-c`  | `moonwall.config.json` | Custom config location. |

---

## 2 – Toolbox keybindings

Once the network is healthy Moonwall drops you into a **TUI** where you can:

* **Tail** (real-time logs) – press **`t`**
* **Run all tests** – press **`T`** (capital T)
* **Grep & run** – press **`g`**, type pattern, **Enter**
* **Pause / resume tail** – press **`p`**
* **Quit** – press **`q`** (network keeps running!)

![toolbox screenshot](/tail.png)

The toolbox is implemented in [`cmds/interactiveCmds`](https://github.com/Moonsong-Labs/moonwall/tree/main/packages/cli/src/cmds/interactiveCmds) using the **Ink** React renderer.

---

## 3 – Re‐using a running network

If processes matching the `launchSpec` are already alive Moonwall will detect them and show:

```bash
The following processes are already running:
moonbeam - pid: 96050, listenPorts: [30333, 9944]
```

You now have three choices:

1. **Kill processes and continue** – Moonwall terminates them and starts fresh.
2. **Continue** – re-use the network (great for local rapid iterations).
3. **Abort** – stop everything and exit.

---

## 4 – Exit codes

`run` always exits with **0** unless there was an unrecoverable error *before* the network was fully up.  Test failures are *ignored* – use `moonwall test` in CI instead.

---

### See also

* [CLI command reference](/guide/cmd/intro)
* [`moonwall test`](/guide/cmd/test)
