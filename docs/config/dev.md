# Dev Networks

The **dev** foundation type allows you to launch a local Substrate-based node for testing. It supports both native binaries and Docker images, as well as optional port, fork, and logging configurations.

## Configuration

- **type**: Must be `"dev"`.
- **launchSpec**: An array of specification objects with the following properties:

| Property                       | Type                                           | Description                                                                                                   |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `name`                         | `string`                                       | A unique name for this environment.                                                                           |
| `binPath`                      | `string`                                       | Path to the node binary or Docker image name.                                                                 |
| `useDocker` (optional)         | `boolean`                                      | If `true`, `binPath` is treated as a Docker image.                                                            |
| `dockerConfig` (optional)      | object                                         | Docker run settings:<br/> • `runArgs?: string[]`<br/> • `containerName?: string`<br/> • `network?: string`<br/> • `exposePorts?: { hostPort: number; internalPort: number; }[]` |
| `disableDefaultEthProviders` (optional) | `boolean`                           | Disable automatic Ethereum provider connections (`ethers`, `web3`, `viem`).                                     |
| `newRpcBehaviour` (optional)   | `boolean`                                      | Use `--rpc-port` instead of `--ws-port` when launching the node.                                               |
| `defaultForkConfig` (optional) | `ForkConfig`                                   | Enable on-start forking of a remote chain state.                                                              |
| `ports` (optional)             | object                                         | Override the P2P, RPC, and WS ports:<br/> • `p2pPort: number`<br/> • `rpcPort: number`<br/> • `wsPort: number` |
| `retainAllLogs` (optional)     | `boolean`                                      | Keep all node logs from previous runs instead of overwriting.                                                 |

### Example

```jsonc
{
  "foundation": {
    "type": "dev",
    "launchSpec": [
      {
        "name": "local-dev",
        "binPath": "my-node-binary",
        "useDocker": false,
        "disableDefaultEthProviders": false,
        "newRpcBehaviour": false,
        "defaultForkConfig": {
          "url": "https://rpc.moonbeam.network",
          "blockHash": "0xabc123...",
          "stateOverridePath": "./state.json",
          "verbose": false
        },
        "ports": { "p2pPort": 30333, "rpcPort": 9933, "wsPort": 9944 },
        "retainAllLogs": true
      }
    ]
  }
}
```

## Fork Config

Moonwall supports forking a remote chain state via the `defaultForkConfig` property. The `ForkConfig` object contains:

| Property               | Type     | Description                       |
| ---------------------- | -------- | --------------------------------- |
| `url`                  | `string` | Full RPC endpoint to fork from.   |
| `blockHash` (optional) | `string` | Block hash to fork at.            |
| `stateOverridePath` (optional) | `string` | Local path to state override file. |
| `verbose` (optional)   | `boolean`| Enable trace logging for debugging. |