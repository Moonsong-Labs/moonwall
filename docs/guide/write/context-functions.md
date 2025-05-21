# Context Functions

Moonwall provides a rich set of context functions for interacting with blockchain networks in your tests. These functions vary based on the foundation type (dev, chopsticks, read_only, zombie) you're using for your test environment.

## Introduction

Context functions are the primary way to interact with your blockchain network during tests. They provide methods for:

- Creating and finalizing blocks
- Setting storage values
- Querying chain state
- Submitting transactions
- Managing network nodes
- Interacting with smart contracts
- And much more

Each foundation type has its own set of context functions tailored to its specific capabilities.

## Common Context Properties

All foundation types provide these core properties:

| Property | Type | Description |
|----------|------|-------------|
| `api()` | Function | Generic function to get an API instance of a specified type |
| `polkadotJs()` | Function | Returns a Polkadot.js API instance |
| `viem()` | Function | Returns a Viem client (Ethereum API) |
| `ethers()` | Function | Returns an Ethers.js wallet instance |
| `web3()` | Function | Returns a Web3.js instance |
| `papi()` | Function | Returns a Polkadot API client (lightweight alternative) |
| `isEthereumChain` | Boolean | Whether the chain is Ethereum-compatible (uses AccountId20) |
| `isSubstrateChain` | Boolean | Whether the chain is a standard Substrate chain (uses AccountId32) |
| `pjsApi` | ApiPromise | Shorthand for context.polkadotJs() |
| `keyring` | Object | Contains key pairs for default accounts (alice, bob, charlie, dave) |

## Dev Mode Context Functions

The Dev foundation provides these additional functions:

| Function | Description | Example |
|----------|-------------|---------|
| `createBlock()` | Creates a block with optional transactions | `await context.createBlock()` |
| `createTxn()` | Creates an Ethereum transaction using viem or ethers | `const tx = context.createTxn({ to: '0x...', value: '0x1' })` |
| `readPrecompile()` | Makes a read call to a precompile contract | `const result = await context.readPrecompile({ precompileName: 'Assets', functionName: 'balanceOf', args: [...] })` |
| `writePrecompile()` | Makes a write call to a precompile contract | `const hash = await context.writePrecompile({ precompileName: 'Staking', functionName: 'delegate', args: [...] })` |
| `readContract()` | Makes a read call to a smart contract | `const result = await context.readContract({ contractName: 'MyContract', functionName: 'getValue' })` |
| `writeContract()` | Makes a write call to a smart contract | `const hash = await context.writeContract({ contractName: 'MyContract', functionName: 'setValue', args: [42] })` |
| `deployContract()` | Deploys a compiled contract | `const contractAddress = await context.deployContract('MyContract', { args: [...] })` |
| `jumpBlocks()` | Advances the chain by a specified number of blocks | `await context.jumpBlocks(100)` |
| `jumpRounds()` | Advances the chain by a specified number of staking rounds | `await context.jumpRounds(2)` |
| `isParachainStaking` | Whether the ParachainStaking pallet is enabled | `if (context.isParachainStaking) { ... }` |

## Chopsticks Context Functions

The Chopsticks foundation provides these additional functions:

| Function | Description | Example |
|----------|-------------|---------|
| `createBlock()` | Creates a block with specified options | `await context.createBlock({ count: 3 })` |
| `setStorage()` | Modifies the chain's storage directly | `await context.setStorage({ module: 'System', method: 'Account', methodParams: [...] })` |
| `upgradeRuntime()` | Performs a runtime upgrade using the specified WASM file | `await context.upgradeRuntime()` |
| `jumpRounds()` | Advances the chain by a specified number of staking rounds | `await context.jumpRounds({ rounds: 2 })` |

## Read-Only Context Functions

The Read-Only foundation provides only the basic context properties for querying the chain state. It does not include functions for modifying the chain state, as it's designed for connecting to existing networks in a non-intrusive way.

## Zombie Context Functions

The Zombie foundation provides these additional functions for managing multi-node Substrate networks:

| Function | Description | Example |
|----------|-------------|---------|
| `createBlock()` | Creates a block with optional transactions | `await context.createBlock()` |
| `restartNode()` | Restarts a specific node in the network | `await context.restartNode('alice')` |
| `pauseNode()` | Pauses a specific node | `await context.pauseNode('alice')` |
| `resumeNode()` | Resumes a paused node | `await context.resumeNode('alice')` |
| `killNode()` | Terminates a node | `await context.killNode('alice')` |
| `isNodeUp()` | Checks if a node is running | `const running = await context.isNodeUp('alice')` |

## Block Creation Options

The `createBlock()` function accepts different options depending on the foundation type:

### Dev Mode Block Creation Options

```typescript
interface BlockCreation {
  parentHash?: string;           // Optional parent hash for the new block
  finalize?: boolean;            // Whether to finalize the block (default: true)
  allowFailures?: boolean;       // Whether to allow extrinsic failures (default: depends on config)
  expectEvents?: AugmentedEvent<ApiTypes>[]; // Expected events in the block
  logger?: Debugger;             // Logger instance for additional output
  signer?: { type: "ethereum" | "sr25519" | "ed25519"; privateKey: string } | KeyringPair; // Account to sign transactions
}
```

### Chopsticks Block Creation Options

```typescript
interface ChopsticksBlockCreation {
  providerName?: string;         // Provider to use for block creation
  count?: number;                // Number of blocks to create
  to?: number;                   // Target block number to create blocks up to
  expectEvents?: AugmentedEvent<ApiTypes>[]; // Expected events in the block
  allowFailures?: boolean;       // Whether to allow extrinsic failures
  logger?: Debugger;             // Logger instance for additional output
}
```

## Event Handling

Many context functions return event records that can be processed using these utility functions:

| Function | Description |
|----------|-------------|
| `filterAndApply()` | Filters events by section and method, then applies a function to matching records |
| `getDispatchError()` | Extracts dispatch error from an event record |
| `extractError()` | Extracts the first dispatch error from a list of event records |
| `isExtrinsicSuccessful()` | Checks if extrinsic was successful based on events |
| `extractInfo()` | Extracts dispatch info from event records |
| `extractFee()` | Extracts fee information from balance events |

## Example Usage

Here's a simple example using dev mode context functions:

```typescript
describeSuite({
  id: "D01",
  title: "Sample test suite",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    it({
      id: "T01",
      title: "Create a block with a balance transfer",
      test: async function () {
        // Check initial state
        const bobAddress = context.keyring.bob.address;
        const initialBalance = await context.polkadotJs().query.system.account(bobAddress);
        
        // Create a transaction and block
        const tx = context.polkadotJs().tx.balances.transferAllowDeath(
          bobAddress, 
          "1000000000000000000"
        );
        
        await context.createBlock(tx);
        
        // Verify state change
        const newBalance = await context.polkadotJs().query.system.account(bobAddress);
        expect(newBalance.data.free.gt(initialBalance.data.free)).toBe(true);
      },
    });
  },
});
```

## Using Context with Different Foundation Types

Here's an example of how to use context functions specific to the Chopsticks foundation:

```typescript
describeSuite({
  id: "C01",
  title: "Chopsticks storage modification",
  foundationMethods: "chopsticks",
  testCases: ({ it, context, log }) => {
    it({
      id: "T01",
      title: "Can modify storage and see the effects",
      test: async function () {
        const address = "0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0";
        const balanceBefore = await context.polkadotJs().query.system.account(address);
        
        // Directly modify chain storage
        await context.setStorage({
          module: "System",
          method: "Account",
          methodParams: [
            [
              [address],
              { data: { free: "1337000000000000000000" }, nonce: 1 },
            ],
          ],
        });
        
        // Create a block to apply changes
        await context.createBlock();
        
        // Verify storage was modified
        const balanceAfter = await context.polkadotJs().query.system.account(address);
        expect(balanceAfter.data.free.gt(balanceBefore.data.free)).toBe(true);
      },
    });
  },
});
```

## Best Practices

1. **Use the appropriate foundation type** for your test needs:
   - `dev` for local development nodes
   - `chopsticks` for forked networks
   - `read_only` for connecting to external networks
   - `zombie` for multi-node test networks

2. **Utilize the context provider functions** to get the appropriate API:
   - `context.polkadotJs()` for Substrate interactions
   - `context.ethers()` or `context.viem()` for Ethereum interactions
   - `context.papi()` for lightweight Polkadot API interactions

3. **Check chain compatibility** with the provided helpers:
   - `context.isEthereumChain` for Ethereum compatibility checks
   - `context.isSubstrateChain` for Substrate-specific features

4. **Handle events properly** by using the provided event helper functions to extract information from blockchain events

5. **Use descriptive test IDs and titles** to make test reports more readable and maintainable