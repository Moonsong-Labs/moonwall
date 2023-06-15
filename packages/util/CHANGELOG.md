# @moonwall/util

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
