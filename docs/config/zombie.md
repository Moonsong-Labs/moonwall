# Zombienet Networks

Use the **zombie** foundation type to launch networks via [Zombienet](https://github.com/paritytech/zombienet){target="_blank"}.

## Configuration

- **type**: Must be `"zombie"`.
- **launchSpec**: An array of specification objects with the following properties:

| Property                        | Type                   | Description                                                                                      |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `name`                          | `string`               | A unique name for this environment.                                                              |
| `configPath`                    | `string`               | Path to your Zombienet configuration file (*.json*).                                             |
| `additionalZombieConfig` (optional) | `object`           | Custom [OrcOptionsInterface](https://github.com/paritytech/zombienet){target="_blank"} settings. |
| `disableDefaultEthProviders` (optional) | `boolean`      | Disable automatic Ethereum provider connections (`ethers`, `web3`, `viem`).                       |
| `disableLogEavesdropping` (optional) | `boolean`           | Turn off eavesdropping on node logs for WARN/ERROR messages.                                       |
| `skipBlockCheck` (optional)     | `string[]`             | Specify any blocks to skip during block monitoring.                                               |

### Example

```jsonc
{
  "foundation": {
    "type": "zombie",
    "launchSpec": [
      {
        "name": "zomb-net",
        "configPath": "./zombienet.json",
        "additionalZombieConfig": { "monitor": true, "spawnConcurrency": 2 },
        "disableDefaultEthProviders": false,
        "disableLogEavesdropping": false,
        "skipBlockCheck": ["block-123", "block-456"]
      }
    ]
  }
}
```

For full parameter details, see the [Foundation Parameters](./foundation.md#zombie) reference.
