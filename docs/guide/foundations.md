# Foundations

Foundations are bundlings of configurations and presets that allow you to quickly execute tests under different network assumptions. Moonwall offers four foundation types, each suited to different testing scenarios.

## Dev

The Dev Foundation runs tests on a local development node with manual seal (blocks are produced only when explicitly triggered).

**When to use:** Repeated lightweight testing, debugging, and rapid iteration.

**How it works:** Moonwall checks for an existing dev node before starting its own. Supports both local binaries and Docker containers.

### Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `binPath` | string | Path to the node binary (or Docker image if `useDocker: true`) |
| `disableDefaultEthProviders` | boolean | Disable automatic Ethereum provider connections (Ethers, Viem, Web3) |
| `newRpcBehaviour` | boolean | Use `rpc-port` instead of `ws-port`. Required for polkadot-SDK v1+ |
| `ports` | object | Custom ports (`p2pPort`, `rpcPort`, `wsPort`). Omit for multithreaded environments |
| `retainAllLogs` | boolean | Keep logs from previous runs (default: overwrite) |

#### Docker Support

Run dev nodes using Docker by setting `useDocker: true`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `useDocker` | boolean | Treat `binPath` as a Docker image |
| `dockerConfig.containerName` | string | Custom container name |
| `dockerConfig.network` | string | Docker network to connect to |
| `dockerConfig.runArgs` | string[] | Additional `docker run` arguments |
| `dockerConfig.exposePorts` | array | Port mappings (`hostPort` → `internalPort`) |

```json
{
  "foundation": {
    "type": "dev",
    "launchSpec": [{
      "name": "moonbeam-docker",
      "binPath": "moonbeamfoundation/moonbeam:latest",
      "useDocker": true,
      "newRpcBehaviour": true
    }]
  }
}
```

#### Startup Caching

Speed up dev node startup (~10x improvement) by caching compiled artifacts:

| Parameter | Type | Description |
|-----------|------|-------------|
| `cacheStartupArtifacts` | boolean | Cache compiled WASM and raw chain specs |
| `startupCacheDir` | string | Cache directory (default: `./tmp/startup-cache`) |

---

## Chopsticks

Uses [Chopsticks](https://github.com/AcalaNetwork/chopsticks) to start a lazily-forked network. State is loaded on-demand, avoiding the need to download the entire blockchain.

**When to use:** Testing runtime upgrades and substrate extrinsics. Not suited for EVM calls (no client RPCs or MetaMask support).

**How it works:** Imports a Chopsticks config file, performs state transitions locally, and can launch single or multiple blockchains.

### Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `configPath` | string | Path to the Chopsticks config file |
| `wsPort` | number | WebSocket port (single mode only) |
| `type` | string | `"relaychain"` or `"parachain"` |
| `wasmOverride` | string | Override runtime with a local WASM file |
| `allowUnresolvedImports` | boolean | Don't throw when host fails to export expected functions (recommended: `true`) |
| `buildBlockMode` | string | `"batch"`, `"manual"`, or `"instant"` (single mode only) |
| `retainAllLogs` | boolean | Keep logs from previous runs |

::: tip
Set `allowUnresolvedImports: true` to avoid Smoldot-related errors.
:::

---

## Read Only

Connects to existing networks without starting any. Works with local dev nodes, live testnets, and production networks.

**When to use:** Smoke tests, querying live networks, or when you're managing network lifecycle yourself.

**How it works:** Moonwall connects to specified endpoints. You can submit transactions, but this will drain wallets on live networks.

### Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `rateLimiter` | boolean \| object | Rate limiter options (default: enabled). Set `false` to disable |
| `disableRuntimeVersionCheck` | boolean | Skip reading runtime name/version for test filtering |

---

## Zombie

Uses [ParityTech's ZombieNet](https://github.com/paritytech/zombienet) to start fresh multi-node networks locally.

**When to use:** Testing cross-chain interactions including XCM. Ideal for relaychain + parachain setups.

**How it works:** Imports a ZombieNet config file and orchestrates multiple nodes using Docker.

### Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `configPath` | string | Path to the ZombieNet config file |
| `additionalZombieConfig` | object | Additional orchestrator options |
| `disableDefaultEthProviders` | boolean | Disable automatic Ethereum provider connections |
| `disableLogEavesdropping` | boolean | Stop logging WARN/ERROR from node logs (default: enabled) |
| `skipBlockCheck` | string[] | Blocks to skip checking |

## Common Parameters

These parameters apply to all foundation types within `launchSpec`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Name of the launch spec |
| `options` | string[] | Additional CLI options for the node |
