## Description

Test harness for testing on Moonbeam, Moonriver and more

## Installation

### NPM Installation
```
npm -g i @moonsong-labs/moonwall
```

> :warning: This package is not yet published as a public npm repository. You can follow the local steps below to use it before then.

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

- Init: Generates a new config file.
- Run: Runs a network.
- Test: Executes tests, and runs a network if neccesary.
- Download: Gets node binaries for polkadot, moonbeam from GH.

## Examples

> :information_source: Use `--help` for more information about arguments for each command

#### Usage
```
npx moonwall
```

```
npx moonwall run <ENV_NAME>
```

```
npx moonwall test <ENV_NAME>
```

```
npx moonwall downalod <ARTIFACT NAME> <VERSION> <PATH>
```

