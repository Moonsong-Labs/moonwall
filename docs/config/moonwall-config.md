<!-- ---
head:
  - - meta
    - name: global-config
      content: Description of the Moonwall Global Config
outline: deep

title: Global Config
--- -->
# Global Config File

The Moonwall global configuration file defines your test environments, scripts, and network launch settings. By default, this file should be named `moonwall.config.json` or `moonwall.config` (JSONC support) and placed in your project's root directory.

::: tip
Use the CLI to generate a starter config interactively:

```sh
pnpm moonwall init
```
:::

## Structure

The configuration adheres to the following JSON schema:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/packages/types/config_schema.json",
  "label": "My Moonwall Config",
  "defaultTestTimeout": 30000,
  "scriptsDir": "scripts",
  "environments": [
    {
      "name": "local",
      "description": "Local development node",
      "timeout": 20000,
      "testFileDir": ["tests"],
      "envVars": ["MY_ENV=VALUE"],
      "foundation": { /* see [Dev Networks](./dev.md) or [Foundation Parameters](./foundation.md) */ },
      "connections": [ /* optional provider configurations */ ],
      "multiThreads": true,
      "contracts": "contracts",
      "runScripts": ["deploy.sh"],
      "defaultSigner": { "type": "sr25519", "privateKey": "0x..." },
      "defaultAllowFailures": false,
      "defaultFinalization": true,
      "skipTests": [],
      "vitestArgs": {}
    }
  ],
  "additionalRepos": [
    {
      "name": "custom-chain",
      "ghAuthor": "example",
      "ghRepo": "custom-chain",
      "binaries": [
        { "name": "custom-node*linux-x86*", "defaultArgs": ["--dev"] }
      ]
    }
  ]
}
```

For detailed field descriptions, refer to the [Environment Configuration](./environment.md) and [Foundation Parameters](./foundation.md) sections.
