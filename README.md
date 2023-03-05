## Description

Test harness for testing on Moonbeam, Moonriver and more

## Installation

- `pnpm i` to install all dependencies.
- `pnpm build` to build the application locally.
- `npx moonwall` to run the application

## Functions

- Init: Generates a new config file.
- Run: Runs a network.
- Test: Executes tests, and runs a network if neccesary.
- Download: Gets node binaries for polkadot, moonbeam from GH.

## Examples

> :information_source: Until this package is published on NPM, it must be installed manually with `npm link` && `npm link moonwall`
> :information_source: Use `--help` for more information about arguments for each command

#### To Run Locally without global install
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

