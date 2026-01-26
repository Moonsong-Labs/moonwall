# Getting Started

## Prerequisites

- [Node.js](https://nodejs.org/) v20.10 or higher
- macOS or Linux (WSL supported)
- [pnpm](https://pnpm.io/) (recommended) or your preferred package manager

## Installation

Install Moonwall as a dev dependency:

::: code-group
```sh [pnpm]
pnpm add -D moonwall
```
```sh [yarn]
yarn add -D moonwall
```
```sh [bun]
bun add -D moonwall
```
```sh [npm]
npm add -D moonwall
```
:::

## Initialize Your Project

Create a Moonwall config file:

```sh
pnpm moonwall init
```

::: tip
Use `--acceptAllDefaults` to skip prompts and generate a config immediately.
:::

This creates:
- `moonwall.config.json` - your test configuration
- `tests/` directory with a sample test
- `scripts/` and `tmp/` directories

The generated config uses Docker by default:

```json
{
  "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/config_schema.json",
  "label": "moonwall_config",
  "defaultTestTimeout": 30000,
  "environments": [{
    "name": "default_env",
    "testFileDir": ["tests/default/"],
    "foundation": {
      "type": "dev",
      "launchSpec": [{
        "name": "moonbeam",
        "useDocker": true,
        "newRpcBehaviour": true,
        "binPath": "moonbeamfoundation/moonbeam"
      }]
    }
  }]
}
```

## Run Your First Test

Run all tests for an environment:

```sh
pnpm moonwall test default_env
```

Or launch the interactive menu:

```sh
pnpm moonwall
```

The menu provides options to:
1. Execute scripts
2. Launch networks and access tooling
3. Run automated tests
4. Download artifacts (node binaries)

### Using Local Binaries

If you prefer local binaries over Docker, download one:

```sh
pnpm moonwall download moonbeam latest ./tmp
```

Then update your config to point to it:

```json
{
  "launchSpec": [{
    "name": "moonbeam",
    "binPath": "./tmp/moonbeam",
    "newRpcBehaviour": true
  }]
}
```

## Next Steps

- **[Foundations](../foundations)** - Understand the different network types
- **[Testing](../testing)** - Write and run tests
- **[Configuration](../../config/moonwall-config)** - Full config reference
- **[Providers](./providers)** - Configure blockchain client connections
