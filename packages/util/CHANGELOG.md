# @moonwall/util

## 5.18.3

### Patch Changes

- 6917699: Refactor regexs
  - @moonwall/types@5.18.3

## 5.18.2

### Patch Changes

- Updated dependencies [450c92e]
  - @moonwall/types@5.18.2

## 5.18.1

### Patch Changes

- @moonwall/types@5.18.1

## 5.18.0

### Patch Changes

- Updated dependencies [760dd82]
  - @moonwall/types@5.18.0

## 5.17.3

### Patch Changes

- 5a67d40: Added globbing for greptest
- Updated dependencies [5a67d40]
  - @moonwall/types@5.17.3

## 5.17.2

### Patch Changes

- @moonwall/types@5.17.2

## 5.17.1

### Patch Changes

- @moonwall/types@5.17.1

## 5.17.0

### Minor Changes

- 6d054eb: Updated Dependencies
  - Fixed ports for `run` mode

### Patch Changes

- Updated dependencies [6d054eb]
  - @moonwall/types@5.17.0

## 5.16.4

### Patch Changes

- @moonwall/types@5.16.4

## 5.16.3

### Patch Changes

- 2fcbc88: Fixes a bug, where urls like `wss://wss.api.moondev.network` were being converted to `https://https.api.moondev.network`, which was incorrect.
  - @moonwall/types@5.16.3

## 5.16.2

### Patch Changes

- @moonwall/types@5.16.2

## 5.16.1

### Patch Changes

- 02340b2: Minor Pkg update
- Updated dependencies [02340b2]
  - @moonwall/types@5.16.1

## 5.16.0

### Minor Changes

- 02d498c: Refactor node process management to Effect-TS:
  - Migrate process spawning and lifecycle management to Effect
  - Add Effect-based services: `ProcessManagerService`, `NodeReadinessService`, `PortDiscoveryService`, `RpcPortDiscoveryService`
  - Replace exec-based node launching with @effect/platform Command
  - Replace native WebSocket readiness checks with @effect/platform Socket
  - Add legacy launch option for backward compatibility
  - Improve port discovery and availability checking
  - Add comprehensive test coverage for Effect services

### Patch Changes

- Updated dependencies [02d498c]
  - @moonwall/types@5.16.0

## 5.15.1

### Patch Changes

- ce9b112: Moonwall's run subcommand stopped working due to port mismatch introduced in #498.
  This PR fixes the issue by accounting for shard offset within the run subcommand.

  - Use singleton class instead of environment variable to manage sharding.
  - Adds port information to error logs to allow checking for port mismatches.
  - @moonwall/types@5.15.1

## 5.15.0

### Minor Changes

- c18fb54: Improves port allocation by taking into consideration test shard number and performing port scanning.

### Patch Changes

- @moonwall/types@5.15.0

## 5.14.0

### Minor Changes

- e3abecf: Refines connection health checks to reduce test flakiness

### Patch Changes

- @moonwall/types@5.14.0

## 5.13.5

### Patch Changes

- Updated dependencies [d550be7]
  - @moonwall/types@5.13.5

## 5.13.4

### Patch Changes

- @moonwall/types@5.13.4

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

### Patch Changes

- Updated dependencies [ad610ae]
  - @moonwall/types@5.13.0

## 5.12.0

### Minor Changes

- c3ac3d9: New Packages

### Patch Changes

- Updated dependencies [c3ac3d9]
  - @moonwall/types@5.12.0

## 5.11.0

### Minor Changes

- eebc9e2: Update Package Deps

### Patch Changes

- Updated dependencies [eebc9e2]
  - @moonwall/types@5.11.0

## 5.10.0

### Patch Changes

- Updated dependencies [626e860]
- Updated dependencies [bfaa04e]
- Updated dependencies [4bc50ea]
  - @moonwall/types@5.10.0

## 5.9.1

### Patch Changes

- @moonwall/types@5.9.1

## 5.9.0

### Minor Changes

- 543bda2: Update Inquirer

### Patch Changes

- Updated dependencies [543bda2]
  - @moonwall/types@5.9.0

## 5.8.0

### Minor Changes

- c792425: Added Fork config to dev foundations

  - BETA: Added ability to use moonbeam's fork API both via moonwall.config and also in a test

### Patch Changes

- Updated dependencies [b8d0d67]
- Updated dependencies [c792425]
  - @moonwall/types@5.8.0

## 5.7.0

### Minor Changes

- 9fed50b: November Update
  - [[#435](https://github.com/Moonsong-Labs/moonwall/issues/435)] Zombienets dont require parachains anymore
  - [[#408](https://github.com/Moonsong-Labs/moonwall/issues/408)] preScript failures halt test runs
  - [[#405](https://github.com/Moonsong-Labs/moonwall/issues/405)] Add PAPI Support

### Patch Changes

- Updated dependencies [9fed50b]
  - @moonwall/types@5.7.0

## 5.6.0

### Minor Changes

- 2c138ed: November Update
  - [[#435](https://github.com/Moonsong-Labs/moonwall/issues/435)] Zombienets dont require parachains anymore
  - [[#408](https://github.com/Moonsong-Labs/moonwall/issues/408)] preScript failures halt test runs

### Patch Changes

- Updated dependencies [2c138ed]
  - @moonwall/types@5.6.0

## 5.5.0

### Minor Changes

- ec1eed4: Update chopsticks

  - Update chopsticks to version 0.16.1 and fixes issue when detecting port on running process
  - Fixes some dependency conflicts

### Patch Changes

- Updated dependencies [ec1eed4]
  - @moonwall/types@5.5.0

## 5.4.0

### Minor Changes

- df30d19: Package Updates

  - Package updates for ETH libs
  - Package updates for PolkadotJS
  - Package updates for tooling
  - Added `--unsafe-force-node-key-generation` to default node args

### Patch Changes

- Updated dependencies [df30d19]
  - @moonwall/types@5.4.0

## 5.3.3

### Patch Changes

- 1b3256a: Update Vitest
  - Use Vitest 2.0.0
  - New menu graphics!
  - GITHUB_TOKEN support on downloader feature
- Updated dependencies [1b3256a]
  - @moonwall/types@5.3.3

## 5.3.2

### Patch Changes

- @moonwall/types@5.3.2

## 5.3.1

### Patch Changes

- bad99a1: Change to forks
- Updated dependencies [bad99a1]
  - @moonwall/types@5.3.1

## 5.3.0

### Patch Changes

- Updated dependencies [b5f857f]
  - @moonwall/types@5.3.0

## 5.2.0

### Minor Changes

- 9f2bcd7: Package Updates (May)

### Patch Changes

- Updated dependencies [9f2bcd7]
  - @moonwall/types@5.2.0

## 5.1.5

### Patch Changes

- 3ec6cde: Package Update
- Updated dependencies [3ec6cde]
  - @moonwall/types@5.1.5

## 5.1.4

### Patch Changes

- 5d82cd9: Another minor gov fn
- Updated dependencies [5d82cd9]
  - @moonwall/types@5.1.4

## 5.1.3

### Patch Changes

- @moonwall/types@5.1.3

## 5.1.2

### Patch Changes

- @moonwall/types@5.1.2

## 5.1.1

### Patch Changes

- c260636: pkg update
- Updated dependencies [c260636]
  - @moonwall/types@5.1.1

## 5.1.0

### Minor Changes

- 17dd589: Package Updates

### Patch Changes

- Updated dependencies [17dd589]
  - @moonwall/types@5.1.0

## 5.0.3

### Patch Changes

- @moonwall/types@5.0.3

## 5.0.2

### Patch Changes

- @moonwall/types@5.0.2

## 5.0.1

### Patch Changes

- cac3d9f: gov fix
- Updated dependencies [cac3d9f]
  - @moonwall/types@5.0.1

## 5.0.0

### Major Changes

- 8bd1877: ESM ONLY

  - This release moves to be an ESM only package!

### Patch Changes

- Updated dependencies [8bd1877]
  - @moonwall/types@5.0.0

## 4.7.9

### Patch Changes

- @moonwall/types@4.7.9

## 4.7.8

### Patch Changes

- @moonwall/types@4.7.8

## 4.7.7

### Patch Changes

- 6d811ef: Gov Helpers
- Updated dependencies [6d811ef]
  - @moonwall/types@4.7.7

## 4.7.6

### Patch Changes

- 0fc4e5e: Linter and Pkg Updates
- Updated dependencies [0fc4e5e]
  - @moonwall/types@4.7.6

## 4.7.5

### Patch Changes

- @moonwall/types@4.7.5

## 4.7.4

### Patch Changes

- @moonwall/types@4.7.4

## 4.7.3

### Patch Changes

- @moonwall/types@4.7.3

## 4.7.2

### Patch Changes

- @moonwall/types@4.7.2

## 4.7.1

### Patch Changes

- 6e530df: pkg updates
- Updated dependencies [6e530df]
  - @moonwall/types@4.7.1

## 4.7.0

### Patch Changes

- Updated dependencies [978f731]
  - @moonwall/types@4.7.0

## 4.6.0

### Minor Changes

- 1f37750: Jan Package Update

### Patch Changes

- Updated dependencies [1f37750]
  - @moonwall/types@4.6.0

## 4.5.1

### Patch Changes

- @moonwall/types@4.5.1

## 4.5.0

### Patch Changes

- @moonwall/types@4.5.0

## 4.4.5

### Patch Changes

- 14d65d8: Another Concurrency Fix
- Updated dependencies [14d65d8]
  - @moonwall/types@4.4.5

## 4.4.4

### Patch Changes

- @moonwall/types@4.4.4

## 4.4.3

### Patch Changes

- efe7ba1: Concurrency Fix
- Updated dependencies [efe7ba1]
  - @moonwall/types@4.4.3

## 4.4.2

### Patch Changes

- d3ba445: Restore Main Stability
- Updated dependencies [d3ba445]
  - @moonwall/types@4.4.2

## 4.4.1

### Patch Changes

- 400a5bb: Extra Fibre work
- Updated dependencies [400a5bb]
  - @moonwall/types@4.4.1

## 4.4.0

### Minor Changes

- f53a25f: Switched to Fibre-based Runtime

### Patch Changes

- @moonwall/types@4.4.0

## 4.3.5

### Patch Changes

- bd6ef1d: Reverting to old exitlogic
- Updated dependencies [bd6ef1d]
  - @moonwall/types@4.3.5

## 4.3.4

### Patch Changes

- @moonwall/types@4.3.4

## 4.3.3

### Patch Changes

- @moonwall/types@4.3.3

## 4.3.2

### Patch Changes

- 3978aed: Package Ver Updates
- Updated dependencies [3978aed]
  - @moonwall/types@4.3.2

## 4.3.1

### Patch Changes

- @moonwall/types@4.3.1

## 4.3.0

### Patch Changes

- @moonwall/types@4.3.0

## 4.2.10

### Patch Changes

- @moonwall/types@4.2.10

## 4.2.9

### Patch Changes

- @moonwall/types@4.2.9

## 4.2.8

### Patch Changes

- 568726d: Pkg Bumps
- Updated dependencies [568726d]
  - @moonwall/types@4.2.8

## 4.2.7

### Patch Changes

- @moonwall/types@4.2.7

## 4.2.6

### Patch Changes

- @moonwall/types@4.2.6

## 4.2.5

### Patch Changes

- 4432c7e: Pkg Updates
- Updated dependencies [4432c7e]
  - @moonwall/types@4.2.5

## 4.2.4

### Patch Changes

- 62c340e: bump
- Updated dependencies [62c340e]
  - @moonwall/types@4.2.4

## 4.2.3

### Patch Changes

- @moonwall/types@4.2.3

## 4.2.2

### Patch Changes

- @moonwall/types@4.2.2

## 4.2.1

### Patch Changes

- @moonwall/types@4.2.1

## 4.2.0

### Minor Changes

- dddc056: New Pool Options

### Patch Changes

- Updated dependencies [dddc056]
  - @moonwall/types@4.2.0

## 4.1.6

### Patch Changes

- Updated dependencies [cc9e654]
  - @moonwall/types@4.1.6

## 4.1.5

### Patch Changes

- bb56086: October Deps Update
- Updated dependencies [bb56086]
  - @moonwall/types@4.1.5

## 4.1.4

### Patch Changes

- 770bfaa: Prevent ether for querying nonce is not needed
  - @moonwall/types@4.1.4

## 4.1.3

### Patch Changes

- @moonwall/types@4.1.3

## 4.1.1

### Patch Changes

- 94e4758: JSON reporting options
- Updated dependencies [4973189]
- Updated dependencies [94e4758]
  - @moonwall/types@4.1.1

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

### Patch Changes

- Updated dependencies [513d509]
  - @moonwall/types@4.1.0

## 4.0.21

### Patch Changes

- e4fe8e9: # Package Updates

  - Updated packages across the board
  - Latest Zombienet version now being used

  > [!WARNING]
  > This is known issue involving plain-specs for [moonbeam](https://github.com/paritytech/zombienet/issues/1270),
  > so you may have to use other dev account nodes on zombienet setups.

- Updated dependencies [e4fe8e9]
  - @moonwall/types@4.0.21

## 4.0.20

### Patch Changes

- @moonwall/types@4.0.20

## 4.0.18

### Patch Changes

- 50084d4: eslint
  - [#239](https://github.com/Moonsong-Labs/moonwall/issues/239)
  - [#238](https://github.com/Moonsong-Labs/moonwall/issues/238)
- Updated dependencies [50084d4]
  - @moonwall/types@4.0.18

## 4.0.17

### Patch Changes

- Updated dependencies [2474534]
  - @moonwall/types@4.0.17

## 4.0.15

### Patch Changes

- Updated dependencies [127a97d]
  - @moonwall/types@4.0.15

## 4.0.14

### Patch Changes

- 8d7ae2a: August Update
  - [#231](https://github.com/Moonsong-Labs/moonwall/issues/231)
  - [#92](https://github.com/Moonsong-Labs/moonwall/issues/92)
  - [#223](https://github.com/Moonsong-Labs/moonwall/issues/223)
  - [#226](https://github.com/Moonsong-Labs/moonwall/issues/226)
  - [#225](https://github.com/Moonsong-Labs/moonwall/issues/225)
- Updated dependencies [8d7ae2a]
  - @moonwall/types@4.0.14

## 4.0.11

### Patch Changes

- 96a442b: Rate Limiter
  - [#222](https://github.com/Moonsong-Labs/moonwall/issues/222)
- Updated dependencies [96a442b]
  - @moonwall/types@4.0.11

## 4.0.10

### Patch Changes

- 4445814: Pkg updates
- dd80fec: Pkg Updates
- Updated dependencies [4445814]
- Updated dependencies [dd80fec]
  - @moonwall/types@4.0.10

## 4.0.8

### Patch Changes

- ef3641a: Deps Upgrade
- Updated dependencies [ef3641a]
  - @moonwall/types@4.0.8

## 4.0.7

### Patch Changes

- 7bf49d8: Small Fixes
- Updated dependencies [7bf49d8]
  - @moonwall/types@4.0.7

## 4.0.5

### Patch Changes

- 86703ac: Updated pkgs
- Updated dependencies [86703ac]
  - @moonwall/types@4.0.5

## 4.0.3

### Patch Changes

- 0c70af6: Better CI
- Updated dependencies [0c70af6]
  - @moonwall/types@4.0.3

## 4.0.2

### Patch Changes

- 5bbd542: replace ts-node with tsx

## 4.0.1

### Patch Changes

- 6015a4d: SMall fix
- Updated dependencies [6015a4d]
  - @moonwall/types@4.0.1

## 4.0.0

### Minor Changes

- 8b486d2: added createTransaction to context
  - [#184](https://github.com/Moonsong-Labs/moonwall/issues/184)
  - [#185](https://github.com/Moonsong-Labs/moonwall/issues/185)
  - [#172](https://github.com/Moonsong-Labs/moonwall/issues/172)
  - [#169](https://github.com/Moonsong-Labs/moonwall/issues/169)
  - [#187](https://github.com/Moonsong-Labs/moonwall/issues/187)

### Patch Changes

- Updated dependencies [8b486d2]
  - @moonwall/types@4.0.0

## 3.0.11

### Patch Changes

- 63aab7e: Added log saving
  - [#175](https://github.com/Moonsong-Labs/moonwall/issues/175)
- Updated dependencies [63aab7e]
  - @moonwall/types@3.0.11

## 3.0.10

### Patch Changes

- f914550: Fix download
- Updated dependencies [f914550]
  - @moonwall/types@3.0.10

## 3.0.9

### Patch Changes

- f9f30de: Extended run cmd
  - [#174](https://github.com/Moonsong-Labs/moonwall/issues/174)
- Updated dependencies [f9f30de]
  - @moonwall/types@3.0.9

## 3.0.8

### Patch Changes

- f983dc9: GetApi fix
- Updated dependencies [f983dc9]
  - @moonwall/types@3.0.8

## 3.0.7

### Patch Changes

- f121ac7: pushing all pkgs
- Updated dependencies [f121ac7]
  - @moonwall/types@3.0.7

## 3.0.6

### Patch Changes

- fc81d29: Pkg update
- Updated dependencies [fc81d29]
  - @moonwall/types@3.0.6

## 3.0.4

### Patch Changes

- Updated dependencies [54f03f9]
  - @moonwall/types@3.0.4

## 3.0.0

### Minor Changes

- 409e085: Big Refactor
  - Many methods changed names
  - Interfaces and types moved around
  - Should be even more typesafe allround and easier to maintain

### Patch Changes

- 2730f58: Added default options to createBlock
  - [#62](https://github.com/Moonsong-Labs/moonwall/issues/62)
  - Moonwall config now has options for the createBlock() function on `dev` foundations
- 4072cb0: Updated Compile Script
  - Updated the solidity compiler script to take into account incremental builds
  - [#157](https://github.com/Moonsong-Labs/moonwall/issues/157)
- d29f57e: Big Refactor
  - big types refactor
  - [#60](https://github.com/Moonsong-Labs/moonwall/issues/60)
- 4ae3228: Added default signer
  - [#63](https://github.com/Moonsong-Labs/moonwall/issues/63)
  - Signer option added to both when creating new blocks `context.createBlock(TXN, {signer: {type:<type>, privateKey: <key>}})
  - Default Signer config option available in moonwall.config for environments
- Updated dependencies [2730f58]
- Updated dependencies [4072cb0]
- Updated dependencies [409e085]
- Updated dependencies [d29f57e]
- Updated dependencies [4ae3228]
  - @moonwall/types@3.0.0

## 2.0.3

### Patch Changes

- 116aed0: Updated Pkgs
- Updated dependencies [116aed0]
  - @moonwall/types@2.0.3

## 2.0.0

### Patch Changes

- Updated dependencies [d21fe62]
  - @moonwall/types@2.0.0

## 1.0.4

### Patch Changes

- Updated dependencies [7085c51]
  - @moonwall/types@1.0.4

## 1.0.3

### Patch Changes

- 67e0359: Updated Web3
- Updated dependencies [67e0359]
  - @moonwall/types@1.0.3

## 1.0.2

### Patch Changes

- 6cd511d: pkg update
- Updated dependencies [6cd511d]
  - @moonwall/types@1.0.2

## 1.0.1

### Patch Changes

- 50a9887: Speed optimization
  - Updated polkadotJs default args for speed
- Updated dependencies [50a9887]
  - @moonwall/types@1.0.1

## 1.0.0

### Minor Changes

- fa3b546: Added forge support
  - [#47](https://github.com/Moonsong-Labs/moonwall/issues/47)
  - [#123](https://github.com/Moonsong-Labs/moonwall/issues/123)
  - [#132](https://github.com/Moonsong-Labs/moonwall/issues/132)
  - [#125](https://github.com/Moonsong-Labs/moonwall/issues/125)

### Patch Changes

- Updated dependencies [fa3b546]
  - @moonwall/types@1.0.0

## 0.5.22

### Patch Changes

- 395f803: Updated Pkgs
- Updated dependencies [395f803]
  - @moonwall/types@0.5.22

## 0.5.21

### Patch Changes

- 2aa7168: New Helpers

## 0.5.20

### Patch Changes

- ffe71e9: New Types Repo

  - [#121](https://github.com/Moonsong-Labs/moonwall/issues/121)
  - pkg updates

- Updated dependencies [ffe71e9]
  - @moonwall/types@0.5.20

## 0.5.19

### Patch Changes

- b2eaefd: ## Viem helpers

  - Added viem helpers
  - Added JSDoc annotations
  - Added strict types to cli pkg
  - [#119](https://github.com/Moonsong-Labs/moonwall/issues/119)

## 0.5.15

### Patch Changes

- 7e3ed8c: Removed pointless logging spam

## 0.5.14

### Patch Changes

- be3aff0: Added custom RPC support

  [#105](https://github.com/Moonsong-Labs/moonwall/issues/105)

  As described [here](https://polkadot.js.org/docs/api/start/rpc.custom/) we can now added custom RPC methods in the `moonwall.config.json` file.

  This can be done by adding the Module and Method details to the provider config as specified in connections:

  ```
  "connections": [
          {
            "name": "para",
            "type": "moon",
            "endpoints": ["ws://127.0.0.1:9944"],
            "rpc": {
              "moon": {
                "isTxFinalized": {
                  "description": "Just a test method",
                  "params": [
                    {
                      "name": "txHash",
                      "type": "Hash"
                    }
                  ],
                  "type": "bool"
                }
              }
            }
          }
        ]
  ```

  > :information_source: Whilst this allows you to send RPC commands via the API, it will not automatically decorate the API in typescript, and will give you errors. Use `// @typescript-expect-error` to stop in-editor errors until a proper api-augment package is developed for your project.
  > :warning: Even if you define a custom method, it will only be callable if it is being returned in the list by `api.rpc.rpc.methods()` which is the list of known RPCs the node exposes.

- b872b17: Upgrades
  Fixes for:
  - [#103](https://github.com/Moonsong-Labs/moonwall/issues/103)
  - [#84](https://github.com/Moonsong-Labs/moonwall/issues/84)

## 0.5.13

### Patch Changes

- 5f7d3b5: Types

## 0.5.10

### Patch Changes

- a9314cf: removed annoying logging lines

## 0.5.9

### Patch Changes

- 0686a87: added blockCheck skip for zombie tests

## 0.5.8

### Patch Changes

- bb2ff9e: Changed to peer deps

## 0.5.5

### Patch Changes

- 3cff27f: Updated PKG Vers

  Fix for:

  - [#43](https://github.com/Moonsong-Labs/moonwall/issues/43)

## 0.5.4

### Patch Changes

- 426d058: Updated Packages
  - Loads of dependency upgrades which hopefully fixes lots of things (maybe it will break things?)

## 0.5.0

### Minor Changes

- c288ebf: Tansii support

## 0.4.12

### Patch Changes

- 99d24bf: Small additions
  - [#79](https://github.com/Moonsong-Labs/moonwall/issues/79)
  - [#56](https://github.com/Moonsong-Labs/moonwall/issues/56)
  - [#61](https://github.com/Moonsong-Labs/moonwall/issues/61)

## 0.4.8

### Patch Changes

- dc3a085: Typo

## 0.4.7

### Patch Changes

- 06830cd: Fixes
  - [#67](https://github.com/Moonsong-Labs/moonwall/issues/67)
  - [#59](https://github.com/Moonsong-Labs/moonwall/issues/59)

## 0.4.5

### Patch Changes

- 1d006b2: Minor Fixes
  - Refactored test fails for CI
  - Improved ZombieNet error messaging #51

## 0.4.2

### Patch Changes

- a9604f3: Bin checking

  This change will check the bin directories and compare to running architecture. It's a bit of a gotcha running `moonwall` on Apple Silicon, because the downloader is for x64 only (for now). Have added checks to both `dev` and `zombie` foundations so that we flag up when there's a discrepancy.

## 0.4.1

### Patch Changes

- 01dcefe: Fixed ethers export

## 0.4.0

### Minor Changes

- 738e30d: Renamed NPM packages

  - Renamed packages to improve developer sanity from having to type it out every file

## 0.3.1

### Patch Changes

- e27c8e8: Refactoring names and types
  - Added dependent types to moonwall-cli to make version tracking easier
  - Web3 and Ethers now close quickly
  - More straight forward to get Connection APIs from tests

## 0.3.0

### Minor Changes

- b8fb424: Big Round of Bugfixes

  This pull request introduces several enhancements and fixes to improve the overall functionality and user experience of the application. Changes include:

  - Shortening the timeout error message for better readability (#27)
  - Adding support for Test or Suite ID as a 2nd argument for the dev command (#25)
  - Displaying available environments for easier selection (#22)
  - Providing instructions for handling missing files (#23)
  - Implementing a pnpm watch script to trigger builds upon file changes (#29)
  - Resolving the issue of createBlock being defined multiple times (#32)
  - Enabling the display of node logs during testing for better monitoring (#33)

## 0.2.11

### Patch Changes

- 1db25dd: ## Extended CreateBlock

  CreateBlock for `Chopsticks` and `Dev` have been updated so taken new options

  - `allowFailures` (Default: false): Will turn off checking for ExtrinsicFailure events
  - `expectEvents` : Takes an array of events, and will verify if the block contains all of those events listed or not.

## 0.2.10

### Patch Changes

- d968780: Added Loggers

  - Added `log()` method to test cases
  - Added `setupLogger()` utility function

## 0.2.9

### Patch Changes

- b53d5e2: Added Types Back!

  Moonbeam Types have been added back to the library, so you can use them in your test files when you import the api-augment package.
  E.g.

  ```
  import "@moonbeam-network/api-augment"
  ```

## 0.2.8

### Patch Changes

- 463e2af: Included new Utils file

## 0.2.7

### Patch Changes

- 515c38e: QoL - Added logging utils

## 0.2.6

### Patch Changes

- 0c48562: Added JSON schema

## 0.2.5

### Patch Changes

- f628150: Disabled auto-forking

  Fork-To-Genesis function has been disabled for the time being until we fix it downstream

## 0.2.4

### Patch Changes

- e33abc6: README change

  - Demo for CI, slight wording change

## 0.2.3

### Patch Changes

- 470a9d0: SegFault BugFix
  - Changed usage of Vitest to remove segfaults
    :information_source: N.B. Bug fix means state separation has been affected. Fix for this is coming next

## 0.2.2

### Patch Changes

- 780429f: Tidied package exports
  - No longer wrapping `ApiPromise` so that it can be augmented as required in test projects

## 0.2.1

### Patch Changes

- 23cc154: Updated READMEs and contribution guide

## 0.2.0

### Major Changes

- 84fee94: ### :warning: This will likely be super buggy for an initial release, whilst we iron out the wrinkles

  - Initial release of `moonwall/util` functions library.
  - Contains constants and useful functions when writing scripts and testing moonbeam networks.
