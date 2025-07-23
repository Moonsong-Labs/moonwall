## Description
![moonwall](docs/public/moonwall.webp)

Moonwall is a comprehensive blockchain test framework for Substrate-based networks

## Documentation

- [Troubleshooting Guide](TROUBLESHOOTING.md) - Solutions for common issues and development workflows

## Installation

### NPM Installation
```
bun add -g @moonwall/cli
```
> Or whichever way you prefer to install via your favourite package manager

### Local Installation

> Package manager `bun` is required for this repo. You can install it following [their instructions](https://bun.sh/docs/installation).

1. `bun install` to install all dependencies.
2. `bun run build` to build the application locally.
3. `bun start` to check that the application runs
4. (In your project dir) `npm i <path_to_moonwall_repo>` to locally add moonwall to your other repo

From here you can import the items you need from moonwall packages in your code:
```
import { describeSuite , beforeAll, expect, ALITH_ADDRESS } from "@moonwall/cli";
import { ALITH_ADDRESS } from "@moonwall/util";
```

## Functions

1. Execute Script: Run scripts placed in your config defined script directory.
2. Network Launcher & Toolbox: Launch network, access tools: tail logs, interactive tests etc.
3. Test Suite Execution: Run automated tests, start network if needed.
4. Artifact Downloader: Fetch artifacts (x86) from GitHub repos.

> :information_source: Use `--help` for more information about arguments for each command

### Usage Examples (non-exhaustive)

- `moonwall` : If you have globally installed moonwall, here is the most minimal entrypoint

- `bun moonwall` : This can be used if locally installed, and will launch the main menu..

- `bun moonwall run <ENV_NAME>` : Run a network specified in your config file.

- `bun moonwall test <ENV_NAME>` : Start network and run tests against it.

- `bun moonwall download <ARTIFACT NAME> <VERSION> <PATH>` : Download an artifact directly from github.


The combinations are endless, for more information you can see the bun docs [here](https://bun.sh/docs/cli/run).
