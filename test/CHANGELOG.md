# @moonwall/tests

## 5.13.2

### Patch Changes

- d550be7: Fix logging for zombie upgrades

## 5.13.1

### Patch Changes

- 0c9d3d2: Added exit reason to logging

## 5.13.0

### Minor Changes

- ad610ae: ## Migrate from debug to pino logger

  - Replace `debug` package with `pino` for improved logging capabilities
  - Add proper log levels support (fatal, error, warn, info, debug, trace, silent)
  - Environment variable changed from `DEBUG=*` to `LOG_LEVEL=<level>`
  - Pretty printing with colors and formatting is always enabled
  - Full multithread support - logs maintain consistent formatting in worker threads and forked processes
  - Logger uses `pino-pretty` stream with `sync: true` for proper output in all execution contexts
  - Test files support `--printlogs` flag to enable test-specific loggers
  - Standardized logger names across the codebase for better log filtering and organization

## 5.12.0

### Minor Changes

- c3ac3d9: New Packages

## 5.11.0

### Minor Changes

- eebc9e2: Update Package Deps

## 5.10.0

### Minor Changes

- 626e860: Add Docker Support
- 4bc50ea: Package Updates

## 5.9.1

## 5.9.0

### Minor Changes

- 543bda2: Update Inquirer

### Patch Changes

- 7cce71c: Added vitest arg pass through

## 5.8.0

### Minor Changes

- c792425: Added Fork config to dev foundations

  - BETA: Added ability to use moonbeam's fork API both via moonwall.config and also in a test

### Patch Changes

- b8d0d67: Add snapshot update option

## 5.7.0

### Minor Changes

- 9fed50b: November Update
  - [[#435](https://github.com/Moonsong-Labs/moonwall/issues/435)] Zombienets dont require parachains anymore
  - [[#408](https://github.com/Moonsong-Labs/moonwall/issues/408)] preScript failures halt test runs
  - [[#405](https://github.com/Moonsong-Labs/moonwall/issues/405)] Add PAPI Support

## 5.6.0

### Minor Changes

- 2c138ed: November Update
  - [[#435](https://github.com/Moonsong-Labs/moonwall/issues/435)] Zombienets dont require parachains anymore
  - [[#408](https://github.com/Moonsong-Labs/moonwall/issues/408)] preScript failures halt test runs

## 5.5.0

### Minor Changes

- ec1eed4: Update chopsticks

  - Update chopsticks to version 0.16.1 and fixes issue when detecting port on running process
  - Fixes some dependency conflicts

## 5.4.0

### Minor Changes

- df30d19: Package Updates

  - Package updates for ETH libs
  - Package updates for PolkadotJS
  - Package updates for tooling
  - Added `--unsafe-force-node-key-generation` to default node args

## 5.3.3

### Patch Changes

- 1b3256a: Update Vitest
  - Use Vitest 2.0.0
  - New menu graphics!
  - GITHUB_TOKEN support on downloader feature

## 5.3.2

## 5.3.1

### Patch Changes

- bad99a1: Change to forks

## 5.3.0

### Minor Changes

- b5f857f: Support skipping tests by ID in config

  This feature is amazing but also dangerous! Remember with great power comes great responsibilities

### Patch Changes

- a73230d: downloader fix

## 5.2.0

### Minor Changes

- 9f2bcd7: Package Updates (May)

## 5.1.5

### Patch Changes

- 3ec6cde: Package Update

## 5.1.4

## 5.1.3

## 5.1.2

## 5.1.1

### Patch Changes

- c260636: pkg update

## 5.1.0

### Minor Changes

- 17dd589: Package Updates

## 5.0.3

## 5.0.2

### Patch Changes

- dad03aa: Support new 1.7.0 upgrade

## 5.0.1

### Patch Changes

- cac3d9f: gov fix

## 5.0.0

### Major Changes

- 8bd1877: ESM ONLY

  - This release moves to be an ESM only package!

## 4.7.9

## 4.7.8

### Patch Changes

- 7a4a5d5: Added Derive TestId feature

## 4.7.7

### Patch Changes

- 6d811ef: Gov Helpers

## 4.7.6

### Patch Changes

- 0fc4e5e: Linter and Pkg Updates

## 4.7.5

## 4.7.4

## 4.7.3

## 4.7.2

## 4.7.1

### Patch Changes

- 6e530df: pkg updates

## 4.7.0

### Minor Changes

- 978f731: Chopsticks Features
  - [#343](https://github.com/Moonsong-Labs/moonwall/issues/343) Fixed
  - [#342](https://github.com/Moonsong-Labs/moonwall/issues/342) Implemented
  - [#140](https://github.com/Moonsong-Labs/moonwall/issues/140) Implemented

## 4.6.0

### Minor Changes

- 1f37750: Jan Package Update

## 4.5.1

## 4.5.0

### Minor Changes

- 5a8c1a4: Concurrency Changes

## 4.4.5

### Patch Changes

- 14d65d8: Another Concurrency Fix

## 4.4.4

## 4.4.3

### Patch Changes

- efe7ba1: Concurrency Fix

## 4.4.2

### Patch Changes

- d3ba445: Restore Main Stability

## 4.4.1

## 4.4.0

### Minor Changes

- f53a25f: Switched to Fibre-based Runtime

## 4.3.5

### Patch Changes

- bd6ef1d: Reverting to old exitlogic

## 4.3.4

## 4.3.3

## 4.3.2

### Patch Changes

- 3978aed: Package Ver Updates

## 4.3.1

## 4.3.0

## 4.2.10

### Patch Changes

- 49b9a0e: Pkg Update

## 4.2.9

## 4.2.8

### Patch Changes

- 568726d: Pkg Bumps

## 4.2.7

## 4.2.6

## 4.2.5

### Patch Changes

- 4432c7e: Pkg Updates

## 4.2.4

### Patch Changes

- 62c340e: bump

## 4.2.3

## 4.2.2

## 4.2.1

## 4.2.0

### Minor Changes

- dddc056: New Pool Options

## 4.1.6

## 4.1.5

### Patch Changes

- bb56086: October Deps Update

## 4.1.4

## 4.1.3

## 4.1.1

### Patch Changes

- 4973189: Added reporter outputs
- 94e4758: JSON reporting options

## 4.1.0

### Minor Changes

- 513d509: # September Update

  - [#258](https://github.com/Moonsong-Labs/moonwall/issues/258)
  - [#254](https://github.com/Moonsong-Labs/moonwall/issues/254)
  - [#251](https://github.com/Moonsong-Labs/moonwall/issues/251)
  - [#224](https://github.com/Moonsong-Labs/moonwall/issues/224)
  - [#255](https://github.com/Moonsong-Labs/moonwall/issues/255)
  - [#262](https://github.com/Moonsong-Labs/moonwall/issues/262)
  - [#49](https://github.com/Moonsong-Labs/moonwall/issues/49)

## 4.0.21

### Patch Changes

- e4fe8e9: # Package Updates

  - Updated packages across the board
  - Latest Zombienet version now being used

  > [!WARNING]
  > This is known issue involving plain-specs for [moonbeam](https://github.com/paritytech/zombienet/issues/1270),
  > so you may have to use other dev account nodes on zombienet setups.

## 4.0.20

## 4.0.18

### Patch Changes

- 50084d4: eslint
  - [#239](https://github.com/Moonsong-Labs/moonwall/issues/239)
  - [#238](https://github.com/Moonsong-Labs/moonwall/issues/238)

## 4.0.17

### Patch Changes

- 2474534: RT upgrade for non-eth chains

## 4.0.14

### Patch Changes

- 8d7ae2a: August Update
  - [#231](https://github.com/Moonsong-Labs/moonwall/issues/231)
  - [#92](https://github.com/Moonsong-Labs/moonwall/issues/92)
  - [#223](https://github.com/Moonsong-Labs/moonwall/issues/223)
  - [#226](https://github.com/Moonsong-Labs/moonwall/issues/226)
  - [#225](https://github.com/Moonsong-Labs/moonwall/issues/225)

## 4.0.12

### Patch Changes

- b9c4120: fix

## 4.0.11

### Patch Changes

- 96a442b: Rate Limiter
  - [#222](https://github.com/Moonsong-Labs/moonwall/issues/222)
