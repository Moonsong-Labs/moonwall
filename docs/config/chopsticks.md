# Chopsticks Networks

The **chopsticks** foundation type leverages the [Chopsticks](https://github.com/AcalaNetwork/chopsticks){target="_blank"} framework for launching single or parachain networks locally.

## Configuration

- **type**: Must be `"chopsticks"`.
- **launchSpec**: An array of specification objects with the following properties:

| Property                | Type                                           | Description                                                                                           |
| ----------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `name`                  | `string`                                       | A unique name for this environment.                                                                   |
| `configPath`            | `string`                                       | Path to your Chopsticks configuration file.                                                           |
| `wsPort` (optional)     | `number`                                       | WebSocket port for single-mode networks.                                                              |
| `type` (optional)       | `"relaychain"` or `"parachain"`                 | Chain type, i.e. solo or parachain                                                    |
| `wasmOverride` (optional)| `string`                                      | Path to a custom WASM runtime override.                                                               |
| `allowUnresolvedImports` (optional)| `boolean`                          | Skip errors when host functions expected by the runtime are missing.                                   |
| `buildBlockMode` (optional)| `"batch" \| "manual" \| "instant"`  | Block building mode for single-mode networks.                                                         |
| `retainAllLogs` (optional)| `boolean`                                    | Keep all node logs from previous runs instead of overwriting.                                         |

### Example

```jsonc
{
  "foundation": {
    "type": "chopsticks",
    "launchSpec": [
      {
        "name": "chops-net",
        "configPath": "./chopsticks.json",
        "wsPort": 9944,
        "type": "relaychain",
        "wasmOverride": "./runtime.wasm",
        "allowUnresolvedImports": true,
        "buildBlockMode": "instant",
        "retainAllLogs": false
      }
    ]
  }
}
```

For full parameter details, see the [Foundation Parameters](./foundation.md#chopsticks) reference.
