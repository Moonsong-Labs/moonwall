## Description

Test harness for testing on Moonbeam, Moonriver and more

## Installation

Run `pnpm i` to install all dependencies

## Functions

- Init: Generates a new config file.
- Run: Runs a network.
- Test: Executes tests, and runs a network if neccesary.

## Examples

> :information_source: Until this package is published on NPM, it must be installed manually with `pnpm link --global`

```
npx moonwall
```

```
npx moonwall run dev_test
```

```
npx moonwall test chop_test
```


