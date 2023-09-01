# Getting Started

## Installation

### Prerequisites

::: info
These steps are not required for projects that already have Moonwall integrated. 
Skip to [Testing - Quick Start](../test/quick-start) for advice on running tests in Moonwall.
:::

- [Node.js](https://nodejs.org/) version 18 or higher.
- MacOS or Linux Operating system (WSL counts!)

Moonwall should be installed as dependency to the project under test.

::: code-group

```sh [pnpm]
pnpm add -D @moonwall/cli
```

```sh [yarn]
yarn add -D @moonwall/cli
```

```sh [bun]
bun add -D @moonwall/cli
```

```sh [npm]
npm add -D @moonwall/cli
```

:::

## Initializing Moonwall

The first thing to do is to create a Moonwall config file. This can be initiated with the command:

::: code-group

```sh [pnpm]
pnpm moonwall init
```

```sh [yarn]
yarn moonwall init
```

```sh [bun]
bun moonwall init
```

```sh [npm]
npm moonwall init
```

:::

which should give you an output like:

```sh
❯ pnpm moonwall init
? Provide a label for the config file (moonwall_config) 
```

From here you can follow the questions in the wizard to build a stock moonwall config to start you off.

::: info
The items in brackets are the default options, which you can accept with `ENTER`
:::

### Foundations

At a certain point you will be asked which foundation you would like to use.
This isn't too important as you will always be able to create new environment specs later, however the TLDR on foundations are:

- `dev` : Running a local node binary and performing tests against it.
- `chopsticks` : Using Acala Foundation's Chopsticks to start a lazily-forked network.
- `read_only`: Not starting a network but instead connecting to one that already exists.
- `zombie`: Using ParityTech's ZombieNetwork framework to run a multi-node network
- `fork` : 🚧 Not yet implemented! Will be part of a new way of forking the network with a real client

::: tip
This is the very brief rundown of foundations. For their specific information please visit the relevant sections in [Config](../../config/environment).
:::

### Generated Config

After following the wizard, the following json file will be created:

```json
{
   "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/packages/types/config_schema.json",
   "label": "moonwall_config",
   "defaultTestTimeout": 30000,
   "environments": [
      {
         "name": "default_env",
         "testFileDir": [
            "tests/"
         ],
         "foundation": {
            "type": "dev"
         },
      }
   ]
}      
```

Currently, to add new networks you must interact with this JSON config file directly, however there are plans in the future to add options to the CLI to assist with this.

::: tip
If using a code-editor like Visual Studio Code, intellisense is available for valid config options for the foundation type you've selected. For more information please check out the [Config](../../config/environment) page.
:::

---
