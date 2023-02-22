## Description

Test harness for testing on Moonbeam, Moonriver and more

## Installation

Run `pnpm i` to install all dependencies

## Functions

- Init: Generates a new config file.
- Run: Runs a network.
- Test: Executes tests, and runs a network if neccesary.
- Download: Gets node binaries for polkadot, moonbeam from GH.

## Examples

> :information_source: Until this package is published on NPM, it must be installed manually with `pnpm link --global`

```
pnpm exec moonwall
```

```
pnpm exec moonwall run dev_test
```

```
pnpm exec moonwall test chop_test
```


