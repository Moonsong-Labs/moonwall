# Read-Only Foundation

The Read-Only foundation provides a way to connect to existing blockchain networks for testing without launching a local node. It's designed for integration tests against live or existing test networks, allowing you to validate functionality against real-world environments.

## Overview

The Read-Only foundation:

- Connects to existing blockchain networks
- Doesn't launch any local nodes
- Provides access to chain APIs but doesn't allow direct state manipulation
- Is ideal for integration tests, smoke tests, and monitoring

## Configuration

Here's how to configure a Read-Only foundation in your Moonwall config:

```json
{
  "foundation": {
    "type": "read_only",
    "launchSpec": {
      "rateLimiter": {
        "maxConcurrent": 5,
        "minTime": 10000
      },
      "disableRuntimeVersionCheck": false
    }
  },
  "connections": [
    {
      "name": "moonbeam",
      "type": "polkadotJs",
      "endpoints": [
        "wss://moonbeam.api.onfinality.io/public-ws"
      ]
    },
    {
      "name": "eth",
      "type": "ethers",
      "endpoints": [
        "wss://moonbeam.api.onfinality.io/public-ws"
      ]
    }
  ]
}
```

### Required Parameters

- **type**: Must be set to `"read_only"` to use this foundation
- **connections**: At least one connection should be defined to connect to an existing network

### Optional Parameters

- **launchSpec**: Configuration options for the foundation
  - **rateLimiter**: Controls the rate of API requests to prevent rate limiting from remote endpoints
    - **maxConcurrent**: Maximum number of concurrent API requests
    - **minTime**: Minimum time between requests in milliseconds
    - Can be set to `false` to disable rate limiting entirely
  - **disableRuntimeVersionCheck**: If true, Moonwall won't check the runtime version for test filtering purposes

## Rate Limiting

The Read-Only foundation includes built-in rate limiting to prevent overwhelming external endpoints. This is especially important when running tests against public infrastructure.

```json
"rateLimiter": {
  "maxConcurrent": 5,  // Maximum number of concurrent requests
  "minTime": 10000     // Minimum time between requests (in ms)
}
```

You can disable rate limiting by setting `"rateLimiter": false` if you're working with your own infrastructure that can handle higher request loads.

## Context Functions

The Read-Only foundation provides these special context functions:

- **waitBlock**: Waits for a specific number of blocks or until a specific block height is reached
  ```typescript
  async waitBlock(
    blocksToWaitFor = 1,
    chainName?: string,
    mode: "height" | "quantity" = "quantity"
  ): Promise<void>
  ```

## Runtime Version Check

By default, Moonwall reads the runtime name and version from the chain metadata for test filtering purposes. This allows you to specify that certain tests should only run on specific runtimes or runtime versions.

You can disable this behavior by setting `"disableRuntimeVersionCheck": true` in your configuration.

## Connection Types

The Read-Only foundation supports various connection types:

- **polkadotJs**: For connecting to Substrate RPC endpoints
- **ethers**: For connecting to EVM-compatible chains with the ethers.js library
- **web3**: For connecting to EVM-compatible chains with web3.js
- **viem**: For connecting to EVM-compatible chains with the viem library
- **papi**: For connecting to chains with the polkadot-api client

## Usage Example

Here's an example of using the Read-Only foundation in a test:

```typescript
describeSuite({
  id: "RO01",
  title: "Read-Only integration test",
  foundationMethods: "read_only",
  testCases: ({ context, it, log }) => {
    it({
      id: "T01",
      title: "Should check chain properties",
      test: async function () {
        // Get chain properties through Polkadot.js API
        const api = context.polkadotJs("moonbeam");
        const properties = await api.rpc.system.properties();
        log(`Chain properties: ${JSON.stringify(properties.toHuman())}`);
        
        // Get block number and wait for next block
        const blockNumber = await api.query.system.number();
        log(`Current block: ${blockNumber}`);
        
        await context.waitBlock(1, "moonbeam");
        
        const newBlockNumber = await api.query.system.number();
        expect(newBlockNumber.toNumber()).to.be.greaterThan(blockNumber.toNumber());
      },
    });
    
    it({
      id: "T02",
      title: "Should check EVM compatibility",
      test: async function () {
        // Use Ethers provider
        const provider = context.ethers("eth");
        const blockNumber = await provider.getBlockNumber();
        log(`Current EVM block: ${blockNumber}`);
        
        // Get chain ID
        const chainId = await provider.getChainId();
        log(`Chain ID: ${chainId}`);
      },
    });
  },
});
```

## Read-Only vs. Other Foundations

When to use Read-Only:

- For integration tests against actual deployed networks
- For monitoring tests to verify network health
- When you want to test against the latest state of a live network
- For smoke tests in CI/CD pipelines

Advantages over other foundations:
- No local node setup required
- Tests against real network conditions
- Can be used for monitoring production environments
- Simpler configuration

Limitations:
- Cannot directly manipulate state
- Subject to network performance and reliability
- May have rate limiting restrictions
- No ability to test state transitions with precise control