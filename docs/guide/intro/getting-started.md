# Getting Started - A Walkthrough

## Installation

### Prerequisites

::: info
These steps are not required for projects that already have Moonwall integrated. 
Skip to [Testing - Quick Start](../test/quick-start) for advice on running tests in Moonwall.
:::

- [Node.js](https://nodejs.org/){target=_blank} version 20.10 or higher.
- MacOS or Linux Operating system (WSL counts!)
- [pNPM](https://pnpm.io/){target=_blank}, a fast and efficient package manager

Moonwall should be installed as dependency to the project under test.

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

You can install Moonwall globally with the following command: 

```sh
pnpm -g i moonwall
```

## Initializing Moonwall

The first thing to do is to create a Moonwall config file. This can be initiated with the command below or you can [use the CLI to take the same steps](/guide/cmd/cli).

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
npx moonwall init
```

:::

which should give you an output like:

```sh
❯ pnpm moonwall init
? Provide a label for the config file (moonwall_config) 
```

From here you can follow the questions in the wizard to build a stock moonwall config to start you off. For information, please see the [init command](/guide/cmd/init). 

::: info
The items in brackets are the default options, which you can accept with `ENTER`
:::

## Foundations

At a certain point you will be asked which foundation you would like to use.
This isn't too important as you will always be able to create new environment specs later, however the TLDR on foundations are:

- `dev` : Running a local node binary and performing tests against it.
- `chopsticks` : Using Acala Foundation's Chopsticks to start a lazily-forked network.
- `read_only`: Not starting a network but instead connecting to one that already exists.
- `zombie`: Using ParityTech's ZombieNetwork framework to run a multi-node network

::: tip
This is the very brief rundown of foundations. For their specific information please visit the relevant sections in [Config](/guide/intro/foundations).
:::

## Generated Config

After following the wizard, the following json file will be created:

```json
{
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

## Downloading a Binary

For this example let's download a copy of the Moonbeam node via the CLI menus.

Launch the app:

::: code-group

```sh [pnpm]
pnpm moonwall
```

```sh [yarn]
yarn moonwall
```

```sh [bun]
bun moonwall
```

```sh [npm]
npx moonwall
```

:::

::: tip
This process can be sped up by directly calling it via [CLI Commands](../cmd/cli).

e.g. `pnpm moonwall download moonbeam latest .`
:::

The main menu will pop up with the following options:

```sh
? Main Menu - Please select one of the following: (Use arrow keys)
  1) Execute Script:                     Run scripts placed in your config defined script directory
❯ 2) Network Launcher & Toolbox:         Launch network, access tools: tail logs, interactive tests
 etc
  3) Test Suite Execution:               Run automated tests, start network if needed
  4) Artifact Downloader:                Fetch artifacts (x86) from GitHub repos
  5) Quit Application
```

Choosing option `4` (via ↕️ keys & ↩️), follow the prompts to download the binary to your desired location (remember this location!)

Open your code editor and edit the `moonwall.config.json` so that it now has the location of the binary:

```json{12-16}
{
   "label": "moonwall_config",
   "defaultTestTimeout": 30000,
   "environments": [
      {
         "name": "default_env",
         "testFileDir": [
            "tests/"
         ],
         "foundation": {
            "launchSpec": [
               {
                  "binPath": "./moonbeam"
                
               }
            ],
            "type": "dev"
         }
      }
   ]
}
```

## Running the Network

Now that we have a very basic environment config, let's start the network!

Open the Moonwall application except this time select: `2) Network Launcher & Toolbox:` and choose the environment you created (this is "default_env" above).

After the node has launched you will see an output like the following:

```sh
  🌐  Node dev has started, listening on ports - Websocket: 10100
  🪵   Log location: /home/hostmachine/workspace/example/getting_started/tmp/node_logs/moonbeam_node_10100_191625.log
  🖥️   https://polkadot.js.org/apps/?rpc=ws%3A%2F%2F127.0.0.1%3A10100
⠼ ✅  Press any key to continue...
```

From here you have a launched network that you can interact with! 🚀

As part of this process, a node has been started and API providers have been created and connected to the network. 
By default, this is `polkadot{.js}`; but for EVM compatible networks this also includes:  `ethers.js`, `viem`, `Web3.js`.

::: info
For more information on all the functions of the `run` command, please read the [Commands - Run](../cmd/run) section of the docs.
:::

## Where to go from here?

Now that you have a running Moonwall Dev environment, it would make sense to write some tests for it: [Writing Tests](../write/quick-start). 

Alternatively, if you are more interested in launching other types of environments it may be worth checking out:
[Environments Config](../../config/environment.md)

Finally, if you have any questions, issues or comments drop us a line at:
[info@moonsonglabs.com](mailto:info@moonsonglabs.com)

---
