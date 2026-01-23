# Architecture

This page provides an overview of Moonwall's internal architecture to help you understand how the framework is organized and how the different components interact.

## Package Structure

Moonwall v1.0.0 is a single unified package, consolidating what was previously split across `@moonwall/cli`, `@moonwall/types`, and `@moonwall/util`.

```
moonwall/
├── src/
│   ├── index.ts          # Public API exports
│   ├── cli.ts            # CLI entry (bin: moonwall)
│   ├── api/              # Types, constants, testing utilities
│   │   ├── types/        # TypeScript types & JSON schema generation
│   │   ├── constants/    # Pre-funded accounts, tokens, precompiles
│   │   └── internal/     # Internal utilities
│   ├── cli/              # CLI commands & libraries
│   │   ├── commands/     # init, test, run, download commands
│   │   └── internal/     # CLI helpers, menus, reporters
│   ├── foundations/      # dev, chopsticks, zombie, read_only
│   └── services/         # Effect.js services (process, network, cache)
├── config_schema.json    # JSON schema for moonwall.config.json
└── test/                 # Internal test suites & examples
```

## Foundation System

Foundations are the core abstraction for launching and managing blockchain networks. Each foundation type handles a specific network deployment strategy.

```mermaid
flowchart TB
    subgraph Config["moonwall.config.json"]
        ENV[Environment]
        FOUND[foundation.type]
    end

    ENV --> FOUND

    FOUND --> |"dev"| DEV[DevFoundation]
    FOUND --> |"chopsticks"| CHOP[ChopsticksFoundation]
    FOUND --> |"zombie"| ZOMBIE[ZombieFoundation]
    FOUND --> |"read_only"| RO[ReadOnlyFoundation]

    DEV --> |"launches"| NODE1[Local Dev Node]
    CHOP --> |"forks"| NODE2[Chopsticks Fork]
    ZOMBIE --> |"orchestrates"| NODE3[Zombienet Cluster]
    RO --> |"connects to"| NODE4[Existing Network]

    NODE1 --> CTX[Test Context]
    NODE2 --> CTX
    NODE3 --> CTX
    NODE4 --> CTX
```

### Foundation Types

| Foundation | Use Case | Network Management |
|------------|----------|-------------------|
| **dev** | Local development, unit tests | Launches local binary (native or Docker) |
| **chopsticks** | State forking, runtime upgrades | Forks live network state locally |
| **zombie** | Multi-node testing, upgrades | Orchestrates Zombienet clusters |
| **read_only** | Smoke tests, monitoring | Connects to existing networks |

## Provider System

Providers are blockchain client libraries that connect to the network and provide APIs for interaction.

```mermaid
flowchart LR
    subgraph Connections["connections[]"]
        C1[polkadotJs]
        C2[ethers]
        C3[web3]
        C4[viem]
        C5[papi]
    end

    C1 --> PF[ProviderFactory]
    C2 --> PF
    C3 --> PF
    C4 --> PF
    C5 --> PF

    PF --> |"creates"| P1["@polkadot/api"]
    PF --> |"creates"| P2["ethers.js"]
    PF --> |"creates"| P3["web3.js"]
    PF --> |"creates"| P4["viem"]
    PF --> |"creates"| P5["polkadot-api"]

    P1 --> CTX[context.pjsApi]
    P2 --> CTX2[context.ethers]
    P3 --> CTX3[context.web3]
    P4 --> CTX4[context.viem]
    P5 --> CTX5[context.papi]
```

### Provider Types

| Provider | Library | Use Case |
|----------|---------|----------|
| `polkadotJs` | @polkadot/api | Substrate-native interactions, pallets |
| `ethers` | ethers.js | EVM interactions, smart contracts |
| `web3` | web3.js | Alternative EVM library |
| `viem` | viem | Modern TypeScript EVM client |
| `papi` | polkadot-api | Lightweight Substrate client |

## Test Execution Flow

```mermaid
sequenceDiagram
    participant CLI as moonwall test
    participant Runner as Vitest
    participant Suite as describeSuite
    participant Found as Foundation
    participant Ctx as Context
    participant Test as Test Cases

    CLI->>Runner: Initialize test environment
    Runner->>Suite: Load test file
    Suite->>Found: Setup foundation
    Found->>Found: Launch/connect to network
    Found->>Ctx: Create test context
    Ctx->>Ctx: Initialize providers
    Suite->>Test: Execute test cases
    Test->>Ctx: Use context.pjsApi, context.ethers, etc.
    Test->>Test: Assertions
    Test-->>Suite: Results
    Suite-->>Found: Teardown
    Found-->>CLI: Cleanup network
```

## Context System

Each foundation type provides a specialized context object to tests with relevant methods and properties.

### DevModeContext

Available when using `dev` foundation:

```typescript
context.pjsApi          // Polkadot.js API
context.ethers          // Ethers.js provider
context.viem            // Viem client
context.web3            // Web3.js instance
context.createBlock()   // Mine a new block
context.createTxn()     // Create transaction helper
context.readPrecompile()// Read precompile data
```

### ChopsticksContext

Available when using `chopsticks` foundation:

```typescript
context.pjsApi          // Polkadot.js API
context.setStorage()    // Override chain storage
context.createBlock()   // Produce new block
context.jumpBlocks()    // Skip forward N blocks
context.upgradeRuntime()// Apply runtime upgrade
```

### ZombieContext

Available when using `zombie` foundation:

```typescript
context.pjsApi          // API for parachain
context.relayApi        // API for relay chain
context.zombieNetwork   // Zombienet network object
```

### ReadOnlyContext

Available when using `read_only` foundation:

```typescript
context.pjsApi          // Polkadot.js API (read-only)
context.ethers          // Ethers.js provider (read-only)
context.viem            // Viem client (read-only)
```

## Services Layer

Moonwall uses [Effect.js](https://effect.website/) for managing side effects like process spawning, file I/O, and network operations.

```mermaid
flowchart TB
    subgraph Services["Effect.js Services"]
        PS[ProcessService]
        NS[NetworkService]
        CS[CacheService]
    end

    PS --> |"spawn/kill"| PROC[Node Processes]
    NS --> |"port allocation"| PORTS[Dynamic Ports]
    CS --> |"metadata caching"| CACHE[Provider Cache]

    PROC --> FOUND[Foundation]
    PORTS --> FOUND
    CACHE --> PROV[Providers]
```

Key services:
- **ProcessService**: Manages node process lifecycle with proper cleanup
- **NetworkService**: Handles port allocation for multi-threaded tests
- **CacheService**: Caches provider metadata for faster connections

## Configuration Flow

```mermaid
flowchart TB
    subgraph Input
        JSON[moonwall.config.json]
        CLI_ARGS[CLI Arguments]
    end

    JSON --> PARSE[Config Parser]
    CLI_ARGS --> PARSE

    PARSE --> VALIDATE[Schema Validation]
    VALIDATE --> CONFIG[MoonwallConfig]

    CONFIG --> ENV_SELECT[Environment Selection]
    ENV_SELECT --> FOUND_INIT[Foundation Init]
    FOUND_INIT --> PROV_INIT[Provider Init]
    PROV_INIT --> TEST_RUN[Test Execution]
```

## Related Documentation

- [Foundations](/guide/intro/foundations) - Detailed foundation usage
- [Providers](/guide/intro/providers) - Provider configuration
- [Environment Configuration](/config/environment) - Environment options
- [Foundation Configuration](/config/foundation) - Foundation parameters
