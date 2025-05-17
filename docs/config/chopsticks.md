# Chopsticks Foundation

The Chopsticks foundation provides a powerful way to test your blockchain by forking a real network's state. It uses the [Chopsticks](https://github.com/AcalaNetwork/chopsticks) tool from Acala Network to create a local node that mimics the state of a live network, allowing you to test changes without affecting the actual network.

## Overview

Chopsticks allows you to:

- Fork an existing blockchain's state and run it locally
- Make state changes and test their effects
- Create blocks manually or automatically
- Perform runtime upgrades in a test environment
- Test multiple connected chains (for XCM testing)

## Configuration

Here's how to configure a Chopsticks foundation in your Moonwall config:

```json
{
  "foundation": {
    "type": "chopsticks",
    "rtUpgradePath": "./path/to/runtime.wasm", // Optional: path to WASM for runtime upgrades
    "launchSpec": [
      {
        "name": "parachain",
        "type": "parachain",
        "buildBlockMode": "manual",
        "configPath": "./configs/myChain.yml",
        "allowUnresolvedImports": true
      }
    ]
  }
}
```

### Required Parameters

- **type**: Must be set to `"chopsticks"` to use this foundation
- **launchSpec**: An array of Chopsticks configuration objects
  - **configPath**: Path to the Chopsticks YAML configuration file (required)

### Optional Parameters

- **rtUpgradePath**: Path to a WASM runtime file for testing runtime upgrades
- **name**: A name for this Chopsticks instance
- **type**: Can be `"relaychain"` or `"parachain"` (Chopsticks-specific parameter)
- **wsPort**: WebSocket port for single-mode Chopsticks (not applicable for XCM mode)
- **wasmOverride**: Path to a local WASM runtime to override the chain's runtime
- **allowUnresolvedImports**: If true, Chopsticks won't throw errors when the host fails to export functions expected by the runtime (recommended to set to true)
- **buildBlockMode**: How blocks are built:
  - `"manual"`: You must explicitly call `createBlock()`
  - `"batch"`: Transactions are batched and blocks built when the batch is submitted
  - `"instant"`: Every transaction creates a new block immediately
- **retainAllLogs**: If true, logs from previous runs won't be cleared
- **address**: Server listening interface (default: localhost)

## Block Modes

The `buildBlockMode` parameter determines how transactions are handled:

- **manual**: You explicitly call `createBlock()` to produce blocks (default)
- **batch**: Transactions are queued and executed when the batch is submitted or when `createBlock()` is called
- **instant**: Every transaction automatically creates a new block

## Multi-Chain Setup

For XCM testing between multiple chains, you can specify multiple configurations in the `launchSpec` array:

```json
"launchSpec": [
  {
    "name": "relaychain",
    "type": "relaychain",
    "buildBlockMode": "manual",
    "configPath": "./configs/polkadot.yml"
  },
  {
    "name": "parachain1",
    "type": "parachain",
    "buildBlockMode": "manual", 
    "configPath": "./configs/moonbeam.yml"
  },
  {
    "name": "parachain2",
    "type": "parachain",
    "buildBlockMode": "manual",
    "configPath": "./configs/assethub.yml"
  }
]
```

## Context Functions

The Chopsticks foundation provides these special context functions:

- **createBlock**: Creates a new block with the specified options
  ```typescript
  async createBlock(options: ChopsticksBlockCreation = {}): Promise<{ result: string }>
  ```
  
- **setStorage**: Allows direct modification of chain storage
  ```typescript
  async setStorage(params: {
    providerName?: string;
    module: string;
    method: string;
    methodParams: any[];
  }): Promise<void>
  ```

- **upgradeRuntime**: Performs a runtime upgrade using the WASM file specified in the configuration
  ```typescript
  async upgradeRuntime(providerName?: string): Promise<void>
  ```

- **jumpRounds**: For chains with ParachainStaking, jumps forward a specified number of rounds
  ```typescript
  async jumpRounds(options: { 
    rounds: number; 
    providerName?: string
  }): Promise<void>
  ```

## Example Configuration File

Here's an example Chopsticks configuration file (YAML):

```yaml
endpoint: wss://moonbeam.api.onfinality.io/public-ws
mock-signature-host: true
block: 1500000 # Block number to fork from
db: ./tmp/chopsticks-cache.db # Optional cache location
runtime-log-level: 5 # 5 = debug
port: 10000 # WebSocket port
```

## Usage Example

Here's an example of using Chopsticks in a test:

```typescript
describeSuite({
  id: "CS01",
  title: "Chopsticks state manipulation test",
  foundationMethods: "chopsticks",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "Should manipulate storage and create blocks",
      test: async function () {
        // Directly modify storage
        await context.setStorage({
          module: "System",
          method: "Number",
          methodParams: [123456]
        });
        
        // Create a new block
        const { result } = await context.createBlock();
        log(`Created block with hash: ${result}`);
        
        // Check the block number is updated
        const blockNumber = await context.polkadotJs().query.system.number();
        expect(blockNumber.toNumber()).to.equal(123456 + 1);
      },
    });
  },
});
```

## Chopsticks vs. Other Foundations

When to use Chopsticks:

- When you need to test against real chain state
- For testing upgrades or storage migrations
- For complex testing scenarios requiring precise state manipulation
- For testing cross-chain communication (XCM)

Advantages over other foundations:
- More realistic test environment using real chain state
- Faster than spinning up full local networks
- Allows direct storage manipulation
- Can simulate complex multi-chain setups