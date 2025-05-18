# Chopsticks Foundation Configuration

The **Chopsticks foundation** plugs Moonwall into a [Chopsticks](https://github.com/AcalaNetwork/chopsticks) ***fork-mode simulator*** instead of a full native node.  
It is perfect when you need to:

* Fork an **existing live chain** at a given block‐height and run unit tests against that snapshot.  
* Spin-up a **relay-chain + parachain** topology in seconds without compiling binaries.  
* Develop locally on a low-powered machine – Chopsticks uses a single WASM runtime and a light JS host.

This page explains **all JSON parameters** that can be placed under

```jsonc
"foundation": {
  "type": "chopsticks",
  "launchSpec": [ { /* …see below… */ } ]
}
```

and shows a complete working example.

---

## 1 – Quick reference

| Property                | Type / Values                              | Required | Description |
|-------------------------|--------------------------------------------|----------|-------------|
| `type`                  | `"chopsticks"`                             | ✅       | Identifies the foundation. |
| `launchSpec`            | `LaunchSpec[]`                             | ✅       | One entry **per chain** (relay or para). |
| `launchSpec[].name`     | `string`                                   | ✅       | An arbitrary label visible in logs. |
| `launchSpec[].configPath`| `string`                                  | ✅*      | Absolute / relative path to a Chopsticks YAML/JSON config. *Required for multi-chain.* |
| `launchSpec[].wsPort`   | `number`                                   | ❌       | Override the WS RPC port (single-chain only). |
| `launchSpec[].type`     | `"relaychain"` \| `"parachain"`          | ❌       | Defaults to `parachain`.  Needed when you start a relay-chain instance. |
| `launchSpec[].wasmOverride` | `string`                                | ❌       | Path to an **alternative runtime** (`.wasm`) that Chopsticks should load instead of the one bundled in the DB. Handy for testing **runtime upgrades**. |
| `launchSpec[].allowUnresolvedImports` | `boolean`                   | ❌       | Skip host-function validation.  Useful when Smoldot complains about unknown imports. Defaults to `true`. |
| `launchSpec[].buildBlockMode` | `"batch"` \| `"manual"` \| `"instant"` | ❌ | How Chopsticks should advance blocks. `batch` (default) creates one block per `dev_newBlock` request, `manual` waits for explicit RPC calls, `instant` auto-builds as soon as there are extrinsics in queue. Single-chain only. |
| `launchSpec[].retainAllLogs` | `boolean`                              | ❌       | Keep *all* previous log files in `tmp/node_logs`. By default Moonwall wipes the folder on every run. |

---

## 2 – Example config

Below we fork the **Moonbeam main-net** at block `3 851 006` and run it on port `9944`.  
We also override the runtime with a *locally compiled* candidate WASM so that tests execute against the **upgrade** before it is on-chain.

```jsonc
{
  "label": "moonwall_config",
  "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/packages/types/config_schema.json",
  "environments": [
    {
      "name": "fork_moonbeam",
      "testFileDir": ["tests/fork/"],
      "foundation": {
        "type": "chopsticks",
        "launchSpec": [
          {
            "name": "moonbeam-fork",
            "configPath": "configs/moonbeamChopsticks.yml",
            "wsPort": 9944,
            "wasmOverride": "tmp/runtime_candidate.wasm",
            "allowUnresolvedImports": true,
            "buildBlockMode": "batch"
          }
        ]
      },
      "connections": [
        {
          "name": "pjs",
          "type": "polkadotJs",
          "endpoints": ["ws://127.0.0.1:9944"]
        },
        {
          "name": "ethers",
          "type": "ethers",
          "endpoints": ["ws://127.0.0.1:9944"]
        }
      ]
    }
  ]
}
```

The corresponding *Chopsticks* YAML (`configs/moonbeamChopsticks.yml`) can be as small as:

```yaml
chain: wss://rpc.api.moonbeam.network
block: 3851006            # ⬅️  starting block-height
db: tmp/chop_db           # ⬅️  persisted DB so subsequent runs are instant
mode: single              # (single | xcm) – XCM needs a relay-chain section too
json: true                # produce JSON logs easier to grep
```

::: info
When `mode` is **xcm** you need **two** entries in `launchSpec`: one for the relay-chain and one for the parachain.  Moonwall waits for **both** WS endpoints to be healthy before running the tests.
:::

---

## 3 – Interacting with the simulator

Once your environment is running you get **two additional helper methods** in the per-test `context`:

```ts
// Build one or many empty blocks
await context.createBlock({ count: 5 });

// Manually set chain head (useful after runtime upgrade)
await context.setHead("0x1234…deadbeef");
```

Under the hood these helpers call the raw RPC methods exposed by Chopsticks:

* `dev_newBlock` – triggered by `context.createBlock()`.
* `dev_setHead`  – triggered by `context.setHead()`.

You can of course call them yourself via `context.polkadotJs().rpc` if you need more exotic parameters.

---

## 4 – Troubleshooting

| Symptom | Fix |
|---------|-----|
| ***`Cannot find providers of type polkadotJs`*** | Verify you added at least one `polkadotJs` entry in `connections` and that the WS port matches `wsPort`. |
| ***`Unknown import function …`*** | Set `allowUnresolvedImports: true` or compile the runtime with all host functions enabled. |
| Chopsticks consumes 100 % CPU  | Switch `buildBlockMode` to `manual` and only create blocks when your tests need them. |

If you are stuck drop by the [Moonwall Discord](https://discord.gg/tX7VnVgFe5) – the team is happy to help.

---

Happy hacking & enjoy your lightning-fast forks! 🚀
