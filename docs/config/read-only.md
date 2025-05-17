# Read-only Networks

Use the **read_only** foundation type to connect to an existing node in read-only mode without launching a local node.

## Configuration

- **type**: Must be `"read_only"`.
- **launchSpec**: An object with the following properties:

| Property                        | Type                               | Description                                                                                  |
| ------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `name`                          | `string`                           | A unique name for this environment.                                                         |
| `rateLimiter` (optional)        | `boolean` or `object`              | Configures a [Bottleneck](https://www.npmjs.com/package/bottleneck){target="_blank"} rate limiter. Set to `false` to disable. |
| `disableRuntimeVersionCheck` (optional) | `boolean`               | When `true`, skips the on-chain runtime name/version check.                                   |

### Example

```jsonc
{
  "foundation": {
    "type": "read_only",
    "launchSpec": {
      "name": "remote-node",
      "rateLimiter": { "maxConcurrent": 5, "minTime": 100 },
      "disableRuntimeVersionCheck": false
    }
  }
}
```

For full parameter details, see the [Foundation Parameters](./foundation.md#read-only) reference.
