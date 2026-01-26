# Global Config File

The `moonwall.config.json` file is the central configuration for your Moonwall testing setup. It lives in the root directory of your project and defines all test environments, network configurations, and global settings.

## JSON Schema

Moonwall provides a JSON schema for config validation and IDE autocompletion. Add this to the top of your config file:

```json
{
  "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/config_schema.json"
}
```

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | `string` | No | URL to the JSON schema for IDE validation |
| `label` | `string` | Yes | A descriptive label for this configuration |
| `defaultTestTimeout` | `number` | Yes | Global timeout for tests in milliseconds |
| `scriptsDir` | `string` | No | Path to directory containing pre/post-test scripts |
| `additionalRepos` | `RepoSpec[]` | No | Custom GitHub repositories for binary downloads |
| `environments` | `Environment[]` | Yes | Array of test environment configurations |

## Example Configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/config_schema.json",
  "label": "My Project Tests",
  "defaultTestTimeout": 60000,
  "scriptsDir": "scripts/",
  "additionalRepos": [
    {
      "name": "astar",
      "ghAuthor": "AstarNetwork",
      "ghRepo": "Astar",
      "binaries": [
        {
          "name": "astar-collator*ubuntu-x86*",
          "type": "tar",
          "defaultArgs": ["--dev", "--sealing=manual"]
        }
      ]
    }
  ],
  "environments": [
    {
      "name": "dev_test",
      "testFileDir": ["tests/"],
      "foundation": {
        "type": "dev",
        "launchSpec": [
          {
            "name": "moonbeam",
            "binPath": "./tmp/moonbeam",
            "newRpcBehaviour": true
          }
        ]
      }
    }
  ]
}
```

## Field Details

### label

A human-readable identifier for your configuration. This is displayed in CLI menus and logs.

```json
"label": "Moonbeam Integration Tests"
```

### defaultTestTimeout

The default timeout (in milliseconds) for all tests. Individual environments can override this with their own `timeout` field.

```json
"defaultTestTimeout": 60000
```

### scriptsDir

Optional path to a directory containing scripts that can be run before tests via the `runScripts` environment option.

```json
"scriptsDir": "scripts/"
```

### additionalRepos

Define custom GitHub repositories for downloading blockchain binaries with `moonwall download`.

```json
"additionalRepos": [
  {
    "name": "hydra",
    "ghAuthor": "galacticcouncil",
    "ghRepo": "hydration-node",
    "binaries": [
      { "name": "hydration" }
    ]
  }
]
```

Moonwall includes built-in support for Polkadot, Tanssi, and Moonbeam repos by default.

### environments

An array of environment configurations. Each environment defines:
- The foundation type (dev, chopsticks, zombie, read_only)
- Network launch specifications
- Test file locations
- Provider connections

See [Environment Configuration](/config/environment) for full details.

## IDE Integration

### VS Code

With the `$schema` field set, VS Code provides:
- Autocompletion for all config fields
- Inline documentation on hover
- Validation errors for invalid values

For enhanced JSON editing, install the [JSON Language Support](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-json) extension.

### JetBrains IDEs

JetBrains IDEs (WebStorm, IntelliJ) automatically detect and use the JSON schema from the `$schema` field.

## Initialization

Generate a new config file using the CLI:

```bash
# Interactive mode
moonwall init

# Accept defaults
moonwall init --acceptAllDefaults
```

This creates a basic `moonwall.config.json` with a dev foundation setup.

## Related Documentation

- [Environment Configuration](/config/environment) - Environment-specific options
- [Foundations](/guide/foundations) - Foundation parameters by type
- [Getting Started](/guide/intro/getting-started) - Initial setup guide
