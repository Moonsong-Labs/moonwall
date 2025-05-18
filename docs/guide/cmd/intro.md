# Moonwall CLI – Command Overview

Moonwall ships a single executable – **`moonwall`** – that wraps all developer workflows:

```
   ▄▄▄▄   ▄  ▄▄▄  ▄▄▄  ▄▄▄▄  ▄▄▄▄ ▄▄▄▄  ▄▄   ▄  ▄▄▄  ▄▄▄
  ▓█   ▀ ▓█ ▓█  ▀ ▓█ ▀▄ ▓█  ▀ ▓█  ▀ ▓█ ▀█ ▓█  ▓█ ▓█  ▀ ▓█  ▀
  ▓█▀▀▄  ▓█ ▓█▀▀  ▓█  ▀ ▓█▀▀  ▓█▀▀  ▓█ ▄▄ ▓█▄▄▓█ ▓█▀▀  ▓█▀▀
  ▓█  ▪▄ ▓█ ▓█    ▓█    ▓█    ▓█    ▓█▀ ▓█ ▓█  ▓█ ▓█    ▓█
  ▀▄▄▄▄▀ ▀  ▀▄▄▄  ▀     ▀     ▀     ▀   ▀ ▀▀  ▀ ▀▀▄▄  ▀▀▄
```

Run it **without arguments** to enter the *interactive UI* or call a sub-command directly:

```bash
# interactive menu
pnpm moonwall

# non-interactive commands
pnpm moonwall init                 # scaffold a new moonwall.config.json
pnpm moonwall run   devnet         # start a network (no tests)
pnpm moonwall test  devnet "B01"  # run selected tests
pnpm moonwall download polkadot v1.5.0 ./bins
```

The sections below provide *tl;dr* tables for every command – the dedicated pages (`run`, `test`, `download`, `init`) dive deeper with examples.

---

## 1 – Command matrix

| Command            | Purpose                                     | Typical workflow |
|--------------------|---------------------------------------------|------------------|
| `moonwall init`    | Bootstrap a fresh **moonwall.config.json**. | First-time setup. |
| `moonwall download`| Fetch **binaries / runtimes** from GitHub.   | CI caching, quick upgrades. |
| `moonwall run`     | Start a network defined in the config and optionally launch the **toolbox** (log tail, shell, interactive tests). | Manual debugging. |
| `moonwall test`    | Spawn (or re-use) a network and execute **Vitest** suites. | Automated QA / CI. |
| `moonwall derive`  | Auto-generate **test IDs** based on folder structure. | Keeping suites organised. |

All commands accept the global flag `--configFile <path>` so you can point Moonwall at an alternative configuration file.

---

## 2 – Interactive UI

When you run **`moonwall`** without parameters it shows one of two menus:

1. **Fresh project** (no config file) – offers *Initialise* & *Artifact Downloader*.
2. **Configured project** – shows *Execute Script*, *Network Launcher & Toolbox*, *Test Suite Execution*, *Artifact Downloader*.

Each menu entry mirrors exactly one of the CLI sub-commands.  Under the hood they call the same functions found in [packages/cli/src/cmds](https://github.com/Moonsong-Labs/moonwall/tree/main/packages/cli/src/cmds).

![Moonwall menu overview](/astromoon.png)

---

## 3 – Passing extra arguments to Vitest

Both `run` and `test` commands expose `--vitestArgPassthrough` so you can forward **any flag** that the upstream runner understands, e.g.

```bash
pnpm moonwall test devnet --vitest "--reporter=json --outputFile=results.json"
```

Moonwall splits the string by spaces and appends it to the internally constructed Vitest command.

---

Continue reading:

* [Run network](/guide/cmd/run)
* [Test suites](/guide/cmd/test)
* [Artifact downloader](/guide/cmd/download)
* [Init wizard](/guide/cmd/init)
