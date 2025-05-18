# Zombienet Foundation Configuration

[`Zombienet`](https://github.com/paritytech/zombienet) spins up **real Substrate nodes inside Docker** and wires them together according to a [network definition spec](https://paritytech.github.io/zombienet/network-definition-spec.html).  
Moonwall’s **zombie foundation** is a thin wrapper that automates the whole lifecycle for you:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Compile / download the node binaries                │
│ 2. `zombienet spawn …` →  relay + para + HRMP channels │
│ 3. Wait for all WS ports to answer                     │
│ 4. Run your Vitest suites                              │
│ 5. On success / fail → `zombienet down`                │
└─────────────────────────────────────────────────────────┘
```

Use this foundation when you need **full consensus**, XCM channels, or pallets that are not supported by fork-mode simulators.

---

## 1 – Quick reference

| Property                                   | Type / Values                  | Required | Description |
|--------------------------------------------|--------------------------------|----------|-------------|
| `type`                                     | `"zombie"`                    | ✅       | Identifies the foundation. |
| `launchSpec[].name`                        | `string`                       | ✅       | A friendly name displayed in logs. |
| `launchSpec[].configPath`                  | `string`                       | ✅       | Path to the Zombienet ***TOML / JSON*** network definition. |
| `launchSpec[].additionalZombieConfig`      | `OrcOptionsInterface`          | ❌       | Extra flags passed directly to the underlying `@zombienet/orchestrator`.  For example `{ verbose: true }`. |
| `disableDefaultEthProviders`               | `boolean`                      | ❌       | Skip automatic `ethers` / `web3` / `viem` providers when the chain has **no EVM pallet**. |
| `disableLogEavesdropping`                  | `boolean`                      | ❌       | Turn off Moonwall’s WARN/ERROR highlighter in node logs. Useful when logs are very verbose. |
| `skipBlockCheck`                           | `string[]`                     | ❌       | List of block hashes that Moonwall should *not* compare against expected heights (handy for bootstrapping long networks). |
| `retainAllLogs`                            | `boolean`                      | ❌       | Keep Docker log files between runs (`tmp/node_logs/zombie_*`). |

All common parameters (`name`, `options`, …) are documented in [`config/foundation`](/config/foundation).

---

## 2 – Example multi-node topology

Assume we have a `zombie.toml` describing **Polkadot + two parachains** (Moonbeam & AssetHub).  Add it to the Moonwall config like so:

```jsonc
{
  "environments": [
    {
      "name": "zombie_network",
      "multiThreads": false,
      "foundation": {
        "type": "zombie",
        "launchSpec": [
          {
            "name": "full-testnet",
            "configPath": "configs/zombie.toml",
            "disableLogEavesdropping": false,
            "additionalZombieConfig": { "timeout": 600000 }
          }
        ]
      },
      "connections": [
        {
          "name": "polkadotjs",
          "type": "polkadotJs",
          "endpoints": ["ws://127.0.0.1:9944"]
        }
      ]
    }
  ]
}
```

When you run `moonwall run zombie_network` Moonwall will:

1. Detect `zombienet` in your PATH (or exit with a helpful error).
2. Spawn the containers described in *configs/zombie.toml*.
3. Expose each WS port in the test `context.providers` array (`context.polkadotJs("relay")`, `context.polkadotJs("moonbeam")`, …).

---

## 3 – Inspecting the network

While the network is up you can **attach** to any node with the interactive toolbox:

1. `moonwall` → **2. Network Launcher & Toolbox**.
2. Pick your environment → `tail` logs or open a **shell** into the container.

All Docker resources are namespaced with the launch-spec name, so you can also use plain Docker commands:

```bash
docker logs -f full-testnet_moonbeam_1  # follow only the Moonbeam node
```

---

## 4 – Common pitfalls

| Error message | Remedy |
|---------------|--------|
| ***`ENOENT zombienet`*** | Install [zombienet ≥ 1.7](https://github.com/paritytech/zombienet) and ensure it is in `$PATH`. |
| `socket connect error` | The WS port defined in the network file is already occupied – pick another one. |
| Tests hang at block 0 | Add `skipBlockCheck: ["GENESIS"]` or check that your parachains are producing blocks. |

---

The Zombienet foundation gives you **full-stack, consensus-accurate** testing without leaving the Moonwall workflow – enjoy! 🧟‍♂️
