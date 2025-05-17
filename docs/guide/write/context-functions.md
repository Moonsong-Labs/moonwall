# Context Functions

Context functions in Moonwall provide powerful capabilities for interacting with blockchain networks in your tests. These functions are accessible through the `context` object passed to your test suites and vary depending on the foundation type you're using.

## Overview

The context object provides:

- Access to blockchain APIs and providers
- Foundation-specific helper functions
- Chain state manipulation capabilities
- Block creation and transaction handling
- Runtime upgrade and network management features

## Common Context Properties

Regardless of foundation type, all context objects include:

### Provider Access

```typescript
// Access Polkadot.js API
const api = context.polkadotJs(); // Default provider
const customApi = context.polkadotJs("customName"); // Named provider

// Access Ethers.js provider
const ethers = context.ethers("eth"); // Named provider

// Access Web3.js provider
const web3 = context.web3("web3"); // Named provider

// Access Viem client
const viem = context.viem("viem"); // Named provider

// Access polkadot-api client
const papi = context.papi("papi"); // Named provider
```

### Provider Type Detection

```typescript
// Check if chain is Ethereum compatible
const isEthChain = context.isEthereumChain;

// Check if chain is Substrate compatible
const isSubChain = context.isSubstrateChain;
```

## Foundation-Specific Context Functions

Each foundation type provides specialized context functions tailored to its capabilities.

### Dev Foundation Context

The Dev foundation provides functions for local development nodes:

#### Create Block

Creates a new block with optional parameters:

```typescript
async createBlock(options?: {
  finalize?: boolean; // Whether to finalize the block
  allowFailures?: boolean; // Whether to allow extrinsic failures
  signer?: KeyringPair; // Signer for the block
}): Promise<BlockCreationResponse>
```

Example:

```typescript
// Create a simple block
const { block } = await context.createBlock();
console.log(`Created block with hash: ${block.hash}`);

// Create block with transaction
const { block, result } = await context.createBlock({
  // Add transactions to the block
  txs: [
    api.tx.balances.transfer(BOB_ADDRESS, 100000000000),
  ],
  // Finalize the block
  finalize: true,
});
```

#### Create Transaction

Send a transaction:

```typescript
async createTxn(options: {
  api?: ApiPromise; // API to use (defaults to context.polkadotJs())
  extrinsic: SubmittableExtrinsic<ApiTypes>; // Extrinsic to send
  signer?: KeyringPair; // Signer for the transaction
}): Promise<ExtrinsicCreation>
```

Example:

```typescript
const tx = context.polkadotJs().tx.balances.transfer(BOB_ADDRESS, 100000000000);
const result = await context.createTxn({
  extrinsic: tx,
  signer: context.keyring.alice,
});

expect(result.successful).to.be.true;
```

#### Runtime Upgrade

Perform a runtime upgrade:

```typescript
async upgradeRuntime(options?: UpgradePreferences): Promise<void>
```

Example:

```typescript
await context.upgradeRuntime({
  runtimeName: "moonbase",
  localPath: "./tmp/moonbase-runtime-2400.wasm",
  upgradeMethod: "Sudo",
  waitMigration: true,
});
```

### Chopsticks Foundation Context

The Chopsticks foundation provides functions for forked networks:

#### Create Block

Creates a new block with options specific to Chopsticks:

```typescript
async createBlock(options?: ChopsticksBlockCreation): Promise<{ result: string }>
```

Example:

```typescript
// Create a simple block
const { result } = await context.createBlock();
console.log(`Created block with hash: ${result}`);

// Create block with expectations
const { result } = await context.createBlock({
  expectEvents: [api.events.balances.Transfer],
  allowFailures: false,
});
```

#### Set Storage

Directly modify chain storage:

```typescript
async setStorage(params: {
  providerName?: string; // Optional provider name
  module: string; // Pallet name
  method: string; // Storage item name
  methodParams: any[]; // Storage item parameters
}): Promise<void>
```

Example:

```typescript
// Set the block number directly
await context.setStorage({
  module: "System",
  method: "Number",
  methodParams: [12345],
});
```

#### Jump Rounds

For chains with ParachainStaking, jumps forward rounds:

```typescript
async jumpRounds(options: {
  rounds: number; // Number of rounds to jump
  providerName?: string; // Optional provider name
}): Promise<void>
```

Example:

```typescript
// Jump forward 5 rounds
await context.jumpRounds({
  rounds: 5,
});
```

#### Runtime Upgrade

Perform a runtime upgrade in Chopsticks:

```typescript
async upgradeRuntime(providerName?: string): Promise<void>
```

Example:

```typescript
// Upgrade the runtime
await context.upgradeRuntime();

// Upgrade a specific provider
await context.upgradeRuntime("parachain");
```

### Zombie Foundation Context

The Zombie foundation provides functions for multi-node networks:

#### Wait Block

Wait for block(s) to be produced:

```typescript
async waitBlock(
  blocksToWaitFor = 1, // Number of blocks to wait for
  chain = "parachain", // Chain name
  mode: "height" | "quantity" = "quantity" // Wait mode
): Promise<void>
```

Example:

```typescript
// Wait for 3 blocks
await context.waitBlock(3, "parachain");

// Wait until specific block height
await context.waitBlock(1000, "relay", "height");
```

#### Node Control Functions

Control node lifecycle:

```typescript
async restartNode(nodeName: string): Promise<void>
async pauseNode(nodeName: string): Promise<void>
async resumeNode(nodeName: string): Promise<void>
async killNode(nodeName: string): Promise<void>
async isUp(nodeName: string): Promise<boolean>
```

Example:

```typescript
// Pause a node
await context.pauseNode("alice");

// Check if node is running
const isRunning = await context.isUp("alice");

// Resume a paused node
await context.resumeNode("alice");
```

#### Runtime Upgrade

Perform a runtime upgrade in a Zombie network:

```typescript
async upgradeRuntime(options?: UpgradePreferences): Promise<void>
```

Example:

```typescript
await context.upgradeRuntime({
  runtimeName: "moonbase",
  localPath: "./tmp/moonbase-runtime-2400.wasm",
  waitMigration: true,
});
```

### Read-Only Foundation Context

The Read-Only foundation provides limited functions for connecting to existing networks:

#### Wait Block

Wait for block(s) to be produced:

```typescript
async waitBlock(
  blocksToWaitFor = 1, // Number of blocks to wait for
  chainName?: string, // Optional chain name
  mode: "height" | "quantity" = "quantity" // Wait mode
): Promise<void>
```

Example:

```typescript
// Wait for 2 blocks
await context.waitBlock(2);

// Wait until specific block height on named chain
await context.waitBlock(1000, "moonbeam", "height");
```

## Utility Helper Functions

Additional utility functions are available for processing blockchain data:

### Event Processing

```typescript
// Extract dispatch error from events
import { extractError } from "@moonwall/util";
const error = extractError(events);

// Check if extrinsic was successful
import { isExtrinsicSuccessful } from "@moonwall/util";
const success = isExtrinsicSuccessful(events);

// Extract dispatch info from events
import { extractInfo } from "@moonwall/util";
const info = extractInfo(events);

// Extract transaction fee
import { extractFee } from "@moonwall/util";
const fee = extractFee(events);
```

### Filter and Apply

Process events with filtering:

```typescript
import { filterAndApply } from "@moonwall/util";

// Get all balances transfers
const transfers = filterAndApply(
  events, 
  "balances", 
  ["Transfer"], 
  (record) => record.event.data
);
```

## Accessing Chain Properties

The context provides ways to access chain properties:

```typescript
// Get chain name
const chainName = await context.polkadotJs().rpc.system.chain();

// Get genesis hash
const genesisHash = await context.polkadotJs().rpc.chain.getBlockHash(0);

// Get runtime version
const runtimeVersion = await context.polkadotJs().rpc.state.getRuntimeVersion();
```

## Provider and Keyring Management

The context includes provider and keyring management:

```typescript
// Access predefined accounts
const aliceAccount = context.keyring.alice;
const bobAccount = context.keyring.bob;
const charlieAccount = context.keyring.charlie;
const daveAccount = context.keyring.dave;

// Get API for a different provider
const paraApi = context.polkadotJs("para");
const relayApi = context.polkadotJs("relay");

// Get direct access to Polkadot.js API
const api = context.pjsApi;
```

## Multi-Chain Testing

For multi-chain setups, you can access different chains:

```typescript
// Access relay chain and parachain
const relay = context.polkadotJs("relay");
const para = context.polkadotJs("para");

// Send cross-chain messages
const xcmMessage = relay.tx.xcmPallet.send(/* XCM parameters */);
await context.createTxn({ extrinsic: xcmMessage });

// Create blocks on both chains
await context.createBlock();
```

## Error Handling

When using context functions, proper error handling is essential:

```typescript
try {
  const result = await context.createBlock();
} catch (error) {
  console.error("Block creation failed:", error);
}
```

For foundation-specific functions, ensure you're using the correct foundation type:

```typescript
it({
  id: "T01",
  title: "Should manipulate storage",
  test: async function () {
    // This will only work with Chopsticks foundation
    if (context.setStorage) {
      await context.setStorage({
        module: "System",
        method: "Number",
        methodParams: [12345],
      });
    } else {
      console.log("This test requires Chopsticks foundation");
    }
  },
});
```

## Logging

You can use the logger provided in the test context:

```typescript
describeSuite({
  id: "S01",
  title: "Logging example",
  foundationMethods: "dev",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "Should log information",
      test: async function () {
        log("Starting test...");
        
        const blockNumber = await context.polkadotJs().query.system.number();
        log(`Current block number: ${blockNumber}`);
        
        // Create a block
        const { block } = await context.createBlock();
        log(`Created block with hash: ${block.hash}`);
      },
    });
  },
});
```

## Best Practices

1. **Use TypeScript for better intellisense and error detection**
2. **Handle foundation-specific functionality with proper checks**
3. **Use async/await with proper error handling**
4. **Log important information for debugging**
5. **Keep tests isolated and independent**
6. **Use appropriate timeouts for blockchain operations**
7. **Add descriptive IDs and titles to test cases**