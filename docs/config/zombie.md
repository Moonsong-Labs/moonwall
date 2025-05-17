# Zombie Foundation

The Zombie foundation provides a powerful way to test multi-node blockchain networks using [Zombienet](https://github.com/paritytech/zombienet), a tool developed by Parity Technologies. It enables testing complex network configurations including relay chains with multiple parachains, making it ideal for advanced test scenarios like runtime upgrades, network resilience, and cross-chain communication.

## Overview

Zombie foundation allows you to:

- Launch multiple interconnected blockchain nodes
- Test parachain-relay chain configurations
- Control node lifecycle (pause, resume, restart, kill)
- Perform runtime upgrades across networks
- Test network behavior during node failures
- Verify cross-chain communication (XCM)

## Configuration

Here's how to configure a Zombie foundation in your Moonwall config:

```json
{
  "foundation": {
    "type": "zombie",
    "rtUpgradePath": "./tmp/moonbase-runtime-2400.wasm",
    "zombieSpec": {
      "name": "zombienet",
      "configPath": "./configs/zombie.json",
      "disableLogEavesdropping": false,
      "additionalZombieConfig": {
        "silent": true
      },
      "skipBlockCheck": []
    }
  }
}
```

### Required Parameters

- **type**: Must be set to `"zombie"` to use this foundation
- **zombieSpec**: Configuration for the Zombienet instance
  - **configPath**: Path to the Zombienet configuration file (required)

### Optional Parameters

- **rtUpgradePath**: Path to a WASM runtime file for testing runtime upgrades
- **zombieSpec**: Additional Zombienet configuration options
  - **name**: A name for this Zombienet instance
  - **disableDefaultEthProviders**: If true, the framework won't automatically connect Ethereum providers
  - **disableLogEavesdropping**: If true, the framework won't monitor and log warnings and errors from node logs
  - **additionalZombieConfig**: Additional configuration options for Zombienet
    - **silent**: Run in silent mode without terminal output
    - **spawnConcurrency**: Number of nodes to spawn concurrently
  - **skipBlockCheck**: Array of node names for which to skip block finalization checks

## Context Functions

The Zombie foundation provides these special context functions:

- **waitBlock**: Waits for a specific number of blocks or until a specific block height is reached
  ```typescript
  async waitBlock(
    blocksToWaitFor = 1,
    chain = "parachain",
    mode: "height" | "quantity" = "quantity"
  ): Promise<void>
  ```

- **upgradeRuntime**: Performs a runtime upgrade using the WASM file specified in the configuration
  ```typescript
  async upgradeRuntime(options: UpgradePreferences = {}): Promise<void>
  ```

- **restartNode**: Restarts a specific node in the network
  ```typescript
  async restartNode(nodeName: string): Promise<void>
  ```

- **pauseNode**: Pauses a specific node in the network
  ```typescript
  async pauseNode(nodeName: string): Promise<void>
  ```

- **resumeNode**: Resumes a paused node in the network
  ```typescript
  async resumeNode(nodeName: string): Promise<void>
  ```

- **killNode**: Completely stops a node in the network
  ```typescript
  async killNode(nodeName: string): Promise<void>
  ```

- **isUp**: Checks if a specific node is running
  ```typescript
  async isUp(nodeName: string): Promise<boolean>
  ```

## Zombienet Configuration File

Zombienet uses a JSON or TOML configuration file that specifies the network topology. Here's an example of a Zombienet configuration file:

```json
{
  "relaychain": {
    "default_command": "./bin/polkadot",
    "default_args": ["--no-hardware-benchmarks", "--no-telemetry"],
    "nodes": [
      {
        "name": "relay-alice",
        "validator": true
      },
      {
        "name": "relay-bob",
        "validator": true
      }
    ]
  },
  "parachains": [
    {
      "id": 1000,
      "chain": "moonbase-local",
      "cumulus_based": true,
      "collator": {
        "name": "moonbase-collator-01",
        "command": "./bin/moonbeam",
        "args": [
          "--no-hardware-benchmarks",
          "--no-telemetry",
          "--execution=wasm"
        ]
      }
    }
  ]
}
```

For full Zombienet configuration options, see the [Zombienet network definition spec](https://paritytech.github.io/zombienet/network-definition-spec.html).

## Runtime Upgrades

The Zombie foundation allows you to test runtime upgrades using the `upgradeRuntime` context method. You can specify:

- **runtimeName**: The name of the runtime to upgrade (default: "moonbase")
- **runtimeTag**: The tag of the runtime (default: "local")
- **localPath**: The path to the WASM file (default: from config's rtUpgradePath)
- **upgradeMethod**: The method to use for upgrading ("Sudo" or another governance mechanism)
- **waitMigration**: If true, wait for migration to complete
- **from**: The account to use for the upgrade

Here's an example of using the runtime upgrade function:

```typescript
await context.upgradeRuntime({
  runtimeName: "moonbase",
  runtimeTag: "local",
  localPath: "./tmp/moonbase-runtime-2401.wasm",
  upgradeMethod: "Sudo",
  waitMigration: true
});
```

## Node Control

Zombienet allows you to control the lifecycle of nodes in the network for testing resilience and recovery scenarios:

```typescript
// Restart a node
await context.restartNode("moonbase-collator-01");

// Pause a node
await context.pauseNode("relay-alice");

// Resume a paused node
await context.resumeNode("relay-alice");

// Kill a node
await context.killNode("relay-bob");

// Check if a node is running
const isRunning = await context.isUp("moonbase-collator-01");
```

## Multi-Chain Setup

For complex multi-chain testing, you can configure multiple parachains and relay chains. Connections to these chains are defined in the environment configuration:

```json
"connections": [
  {
    "name": "relay",
    "type": "polkadotJs",
    "endpoints": [
      "ws://127.0.0.1:9944"
    ]
  },
  {
    "name": "para1",
    "type": "polkadotJs",
    "endpoints": [
      "ws://127.0.0.1:9988"
    ]
  },
  {
    "name": "para2",
    "type": "polkadotJs",
    "endpoints": [
      "ws://127.0.0.1:9999"
    ]
  }
]
```

## Usage Example

Here's an example of using the Zombie foundation in a test:

```typescript
describeSuite({
  id: "Z01",
  title: "Zombie network resilience test",
  foundationMethods: "zombie",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "Should continue producing blocks when a relay validator is paused",
      test: async function () {
        // Get the current block number
        const parachain = context.polkadotJs("para1");
        const relay = context.polkadotJs("relay");
        
        const initialParaBlock = await parachain.query.system.number();
        const initialRelayBlock = await relay.query.system.number();
        
        log(`Initial parachain block: ${initialParaBlock}`);
        log(`Initial relay block: ${initialRelayBlock}`);
        
        // Pause a relay validator
        await context.pauseNode("relay-alice");
        log("Paused relay-alice validator");
        
        // Wait for more blocks
        await context.waitBlock(5, "para1");
        
        // Check that blocks are still being produced
        const newParaBlock = await parachain.query.system.number();
        expect(newParaBlock.toNumber()).to.be.greaterThan(initialParaBlock.toNumber());
        
        // Resume the validator
        await context.resumeNode("relay-alice");
        log("Resumed relay-alice validator");
      },
    });
    
    it({
      id: "T02",
      title: "Should successfully perform a runtime upgrade",
      test: async function () {
        const api = context.polkadotJs("para1");
        
        // Get the current runtime version
        const initialVersion = await api.rpc.state.getRuntimeVersion();
        log(`Initial runtime version: ${initialVersion.specVersion}`);
        
        // Perform runtime upgrade
        await context.upgradeRuntime({
          waitMigration: true
        });
        
        // Check new runtime version
        const newVersion = await api.rpc.state.getRuntimeVersion();
        log(`New runtime version: ${newVersion.specVersion}`);
        
        expect(newVersion.specVersion.toNumber()).to.be.greaterThan(
          initialVersion.specVersion.toNumber()
        );
      },
    });
  },
});
```

## Zombie vs. Other Foundations

When to use Zombie:

- For testing multi-node networks
- For parachain-relay chain integration testing
- For testing runtime upgrades across networks
- For testing network resilience during node failures
- For verifying cross-chain communication (XCM)

Advantages over other foundations:
- Most complete test environment
- Realistic network topology
- Can test parachain-relay chain interactions
- Supports node lifecycle management
- Closest to production environment

Limitations:
- Higher resource requirements
- More complex configuration
- Longer startup times