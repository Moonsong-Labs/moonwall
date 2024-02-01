## Description
![moonwall](./moonwall.png)

Moonwall is a comprehensive blockchain test framework for Substrate-based networks

## Installation

### NPM Installation
```
pnpm -g i @moonwall/cli
```
> Or whichever way you prefer to install via your favourite package manager

### Local Installation

> Package manager `pnpm` is required for this repo. You can install it with `npm install -g pnpm` or otherwise following [their instructions](https://pnpm.io/installation).

1. `pnpm i` to install all dependencies.
2. `pnpm build` to build the application locally.
3. `pnpm start` to check that the application runs
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

- `pnpm moonwall` : This can be used if locally installed, and will launch the main menu..

- `pnpx @moonwall/cli run <ENV_NAME>` : To download and run the latest moonwall binary from npm.js repository, and run a network specified in your config file.

- `pnpm exec moonwall test <ENV_NAME>` : To run the locally compiled version of the binary, to start network and run tests against it.

- `pnpm moonwall download <ARTIFACT NAME> <VERSION> <PATH>` : To run the locally compiled version of the binary, to download an artifact directly from github.


The combinations are endless, for more information you can see the pnpm docs [here](https://pnpm.io/cli/run).
