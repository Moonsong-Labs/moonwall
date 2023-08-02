# @moonwall/cli

## 4.0.8

### Patch Changes

- ef3641a: Deps Upgrade
- Updated dependencies [ef3641a]
  - @moonwall/types@4.0.8
  - @moonwall/util@4.0.8

## 4.0.7

### Patch Changes

- 7bf49d8: Small Fixes
- Updated dependencies [7bf49d8]
  - @moonwall/types@4.0.7
  - @moonwall/util@4.0.7

## 4.0.6

### Patch Changes

- 786d3ab: ENv Var support
  - [#202](https://github.com/Moonsong-Labs/moonwall/issues/202)
  - [#206](https://github.com/Moonsong-Labs/moonwall/issues/206)

## 4.0.5

### Patch Changes

- 86703ac: Updated pkgs
- Updated dependencies [86703ac]
  - @moonwall/types@4.0.5
  - @moonwall/util@4.0.5

## 4.0.4

### Patch Changes

- 84f5f3b: Fix zombie RT fn to accept custom signers

## 4.0.3

### Patch Changes

- 0c70af6: Better CI
- Updated dependencies [0c70af6]
  - @moonwall/types@4.0.3
  - @moonwall/util@4.0.3

## 4.0.2

### Patch Changes

- 5bbd542: replace ts-node with tsx
- Updated dependencies [5bbd542]
  - @moonwall/util@4.0.2

## 4.0.1

### Patch Changes

- 6015a4d: SMall fix
- Updated dependencies [6015a4d]
  - @moonwall/types@4.0.1
  - @moonwall/util@4.0.1

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
  - @moonwall/util@4.0.0

## 3.0.11

### Patch Changes

- 63aab7e: Added log saving
  - [#175](https://github.com/Moonsong-Labs/moonwall/issues/175)
- Updated dependencies [63aab7e]
  - @moonwall/types@3.0.11
  - @moonwall/util@3.0.11

## 3.0.10

### Patch Changes

- f914550: Fix download
- Updated dependencies [f914550]
  - @moonwall/types@3.0.10
  - @moonwall/util@3.0.10

## 3.0.9

### Patch Changes

- f9f30de: Extended run cmd
  - [#174](https://github.com/Moonsong-Labs/moonwall/issues/174)
- Updated dependencies [f9f30de]
  - @moonwall/types@3.0.9
  - @moonwall/util@3.0.9

## 3.0.8

### Patch Changes

- f983dc9: GetApi fix
- Updated dependencies [f983dc9]
  - @moonwall/types@3.0.8
  - @moonwall/util@3.0.8

## 3.0.7

### Patch Changes

- f121ac7: pushing all pkgs
- 1f0f77c: Fixed greptest
  - [#165](https://github.com/Moonsong-Labs/moonwall/issues/165)
- Updated dependencies [f121ac7]
  - @moonwall/types@3.0.7
  - @moonwall/util@3.0.7

## 3.0.6

### Patch Changes

- fc81d29: Pkg update
- Updated dependencies [fc81d29]
  - @moonwall/util@3.0.6
  - @moonwall/types@3.0.6

## 3.0.5

### Patch Changes

- 22c7b57: fix upgrade fn

## 3.0.4

### Patch Changes

- 54f03f9: fix for chain upgrading rt2400+
- Updated dependencies [54f03f9]
  - @moonwall/types@3.0.4
  - @moonwall/util@3.0.4

## 3.0.3

### Patch Changes

- 66a727e: Handler fix

## 3.0.2

### Patch Changes

- 6efab3f: Testcase number fix

## 3.0.1

### Patch Changes

- a9c0f9a: minorest fix

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
  - @moonwall/util@3.0.0

## 2.0.4

### Patch Changes

- 3b6b2df: Minor tansii fix
  - [#153](https://github.com/Moonsong-Labs/moonwall/issues/153)

## 2.0.3

### Patch Changes

- 116aed0: Updated Pkgs
- Updated dependencies [116aed0]
  - @moonwall/types@2.0.3
  - @moonwall/util@2.0.3

## 2.0.2

### Patch Changes

- d27c46c: fix again

## 2.0.1

### Patch Changes

- 2617136: Fix for scripts

## 2.0.0

### Minor Changes

- d21fe62: Script support
  - [#74](https://github.com/Moonsong-Labs/moonwall/issues/74)
  - Removed foundry support

### Patch Changes

- Updated dependencies [d21fe62]
  - @moonwall/types@2.0.0
  - @moonwall/util@2.0.0

## 1.0.4

### Patch Changes

- c7f0b52: Fix GrepTest for Running networks
  - [#144](https://github.com/Moonsong-Labs/moonwall/issues/144)
- 7085c51: Tansii Changes
  - [#145](https://github.com/Moonsong-Labs/moonwall/issues/145)
- Updated dependencies [7085c51]
  - @moonwall/types@1.0.4
  - @moonwall/util@1.0.4

## 1.0.3

### Patch Changes

- 67e0359: Updated Web3
- Updated dependencies [67e0359]
  - @moonwall/types@1.0.3
  - @moonwall/util@1.0.3

## 1.0.2

### Patch Changes

- 6cd511d: pkg update
- Updated dependencies [6cd511d]
  - @moonwall/types@1.0.2
  - @moonwall/util@1.0.2

## 1.0.1

### Patch Changes

- 50a9887: Speed optimization
  - Updated polkadotJs default args for speed
- Updated dependencies [50a9887]
  - @moonwall/types@1.0.1
  - @moonwall/util@1.0.1

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
  - @moonwall/util@1.0.0

## 0.5.22

### Patch Changes

- 395f803: Updated Pkgs
- Updated dependencies [395f803]
  - @moonwall/types@0.5.22
  - @moonwall/util@0.5.22

## 0.5.21

### Patch Changes

- 2aa7168: New Helpers
- Updated dependencies [2aa7168]
  - @moonwall/util@0.5.21

## 0.5.20

### Patch Changes

- ffe71e9: New Types Repo

  - [#121](https://github.com/Moonsong-Labs/moonwall/issues/121)
  - pkg updates

- Updated dependencies [ffe71e9]
  - @moonwall/util@0.5.20
  - @moonwall/types@0.5.20

## 0.5.19

### Patch Changes

- b2eaefd: ## Viem helpers

  - Added viem helpers
  - Added JSDoc annotations
  - Added strict types to cli pkg
  - [#119](https://github.com/Moonsong-Labs/moonwall/issues/119)

- Updated dependencies [b2eaefd]
  - @moonwall/util@0.5.19

## 0.5.18

### Patch Changes

- fb6c6bc: Fix

## 0.5.17

### Patch Changes

- b2aa4f6: Small fix for tansii

## 0.5.16

### Patch Changes

- 881b0e3: Added Viem as provider type

## 0.5.15

### Patch Changes

- 7e3ed8c: Removed pointless logging spam
- Updated dependencies [7e3ed8c]
  - @moonwall/util@0.5.15

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
            "type": "polkadotJs",
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
- Updated dependencies [be3aff0]
- Updated dependencies [b872b17]
  - @moonwall/util@0.5.14

## 0.5.13

### Patch Changes

- 5f7d3b5: Types
- Updated dependencies [5f7d3b5]
  - @moonwall/util@0.5.13

## 0.5.12

### Patch Changes

- 54bd2f7: change config to use reporters

## 0.5.11

### Patch Changes

- c595a25: attempt to fix logs

## 0.5.10

### Patch Changes

- a9314cf: removed annoying logging lines
- Updated dependencies [a9314cf]
  - @moonwall/util@0.5.10

## 0.5.9

### Patch Changes

- 0686a87: added blockCheck skip for zombie tests
- Updated dependencies [0686a87]
  - @moonwall/util@0.5.9

## 0.5.8

### Patch Changes

- bb2ff9e: Changed to peer deps
- Updated dependencies [bb2ff9e]
  - @moonwall/util@0.5.8

## 0.5.7

### Patch Changes

- 58cdb79: fixing types

## 0.5.6

### Patch Changes

- 35a89d6: Added ApiDecoration to exported types

## 0.5.5

### Patch Changes

- 3cff27f: Updated PKG Vers

  Fix for:

  - [#43](https://github.com/Moonsong-Labs/moonwall/issues/43)

- Updated dependencies [3cff27f]
  - @moonwall/util@0.5.5

## 0.5.4

### Patch Changes

- 426d058: Updated Packages
  - Loads of dependency upgrades which hopefully fixes lots of things (maybe it will break things?)
- Updated dependencies [426d058]
  - @moonwall/util@0.5.4

## 0.5.3

### Patch Changes

- 2973246: Fix for tansii

## 0.5.2

### Patch Changes

- 40e7868: Fix waitblock for zombie

## 0.5.1

### Patch Changes

- 7ec3a9c: minor fix

## 0.5.0

### Minor Changes

- c288ebf: Tansii support

### Patch Changes

- 80473ae: Multi Zombie
- Updated dependencies [c288ebf]
  - @moonwall/util@0.5.0

## 0.4.12

### Patch Changes

- 99d24bf: Small additions
  - [#79](https://github.com/Moonsong-Labs/moonwall/issues/79)
  - [#56](https://github.com/Moonsong-Labs/moonwall/issues/56)
  - [#61](https://github.com/Moonsong-Labs/moonwall/issues/61)
- Updated dependencies [99d24bf]
  - @moonwall/util@0.4.12

## 0.4.11

### Patch Changes

- a516f22: arm64 support

## 0.4.10

### Patch Changes

- 7d78a5a: Added Zombie UpdateNetwork options
  - small change to allow custom upgradeNetwork options for zombie networks

## 0.4.9

### Patch Changes

- 3a870d4: Removed timeout for waitblock

## 0.4.8

### Patch Changes

- dc3a085: Typo
- Updated dependencies [dc3a085]
  - @moonwall/util@0.4.8

## 0.4.7

### Patch Changes

- 06830cd: Fixes
  - [#67](https://github.com/Moonsong-Labs/moonwall/issues/67)
  - [#59](https://github.com/Moonsong-Labs/moonwall/issues/59)
- Updated dependencies [06830cd]
  - @moonwall/util@0.4.7

## 0.4.6

### Patch Changes

- 43c5d7c: Minor Fix

## 0.4.5

### Patch Changes

- 1d006b2: Minor Fixes
  - Refactored test fails for CI
  - Improved ZombieNet error messaging #51
- Updated dependencies [1d006b2]
  - @moonwall/util@0.4.5

## 0.4.4

### Patch Changes

- a13ae96: CI updates and Zombie Fixes

  - Test failures should bubble up to CI correctly now
  - Zombienet now supports multiple collators

## 0.4.3

### Patch Changes

- 0cb5d7a: Zombienet logging

  - Added the ability to tail with zombienet
  - Changed the `.substrateApi()` getter on context to the more familiar `.polkadotJs()`

## 0.4.2

### Patch Changes

- a9604f3: Bin checking

  This change will check the bin directories and compare to running architecture. It's a bit of a gotcha running `moonwall` on Apple Silicon, because the downloader is for x64 only (for now). Have added checks to both `dev` and `zombie` foundations so that we flag up when there's a discrepancy.

- Updated dependencies [a9604f3]
  - @moonwall/util@0.4.2

## 0.4.1

### Patch Changes

- 01dcefe: Fixed ethers export
- Updated dependencies [01dcefe]
  - @moonwall/util@0.4.1

## 0.4.0

### Minor Changes

- 738e30d: Renamed NPM packages

  - Renamed packages to improve developer sanity from having to type it out every file

### Patch Changes

- Updated dependencies [738e30d]
  - @moonwall/util@0.4.0

## 0.3.1

### Patch Changes

- e27c8e8: Refactoring names and types
  - Added dependent types to moonwall-cli to make version tracking easier
  - Web3 and Ethers now close quickly
  - More straight forward to get Connection APIs from tests
- 322988c: Added Progress bar

  - Added Progress bar to artifact downloader. Potentially quite useful for users with slow connections, and if we need to download bigger files in the future.

- Updated dependencies [e27c8e8]
  - @moonwall/util@0.3.1

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

### Patch Changes

- Updated dependencies [b8fb424]
  - @moonwall/util@0.3.0

## 0.2.14

### Patch Changes

- 1db25dd: ## Extended CreateBlock

  CreateBlock for `Chopsticks` and `Dev` have been updated so taken new options

  - `allowFailures` (Default: false): Will turn off checking for ExtrinsicFailure events
  - `expectEvents` : Takes an array of events, and will verify if the block contains all of those events listed or not.

- Updated dependencies [1db25dd]
  - @moonwall/util@0.2.11

## 0.2.13

### Patch Changes

- b243e2a: Fix
  - Small fix to GHA

## 0.2.12

### Patch Changes

- d968780: Added Loggers

  - Added `log()` method to test cases
  - Added `setupLogger()` utility function

- Updated dependencies [d968780]
  - @moonwall/util@0.2.10

## 0.2.11

### Patch Changes

- d3fba82: Fix

## 0.2.10

### Patch Changes

- b53d5e2: Added Types Back!

  Moonbeam Types have been added back to the library, so you can use them in your test files when you import the api-augment package.
  E.g.

  ```
  import "@moonbeam-network/api-augment"
  ```

- Updated dependencies [b53d5e2]
  - @moonwall/util@0.2.9

## 0.2.9

### Patch Changes

- Updated dependencies [463e2af]
  - @moonwall/util@0.2.8

## 0.2.8

### Patch Changes

- Updated dependencies [515c38e]
  - @moonwall/util@0.2.7

## 0.2.7

### Patch Changes

- 4e6ef84: ## Added Grep & QoL

  - New option to `grep` test cases

    - Filter by name/id either via the run menu, TestGrep command
    - Filter by name/id as option when calling `pnpm moonwall test <env_name>` directly with new option `-g`

  - Increased GUI's height

  - Application will inform user if newer version available

  - Ability to skip test suites or cases based on which RT version/ chain name

## 0.2.6

### Patch Changes

- 474ac96: Added proper state separation between testFiles (multi or sequential)
- 0c48562: Added JSON schema
- Updated dependencies [0c48562]
  - @moonwall/util@0.2.6

## 0.2.5

### Patch Changes

- f628150: Disabled auto-forking

  Fork-To-Genesis function has been disabled for the time being until we fix it downstream

- Updated dependencies [f628150]
  - @moonwall/util@0.2.5

## 0.2.4

### Patch Changes

- Updated dependencies [e33abc6]
  - @moonwall/util@0.2.4

## 0.2.3

### Patch Changes

- 470a9d0: SegFault BugFix
  - Changed usage of Vitest to remove segfaults
    :information_source: N.B. Bug fix means state separation has been affected. Fix for this is coming next
- Updated dependencies [470a9d0]
  - @moonwall/util@0.2.3

## 0.2.2

### Patch Changes

- 780429f: Tidied package exports
  - No longer wrapping `ApiPromise` so that it can be augmented as required in test projects
- Updated dependencies [780429f]
  - @moonwall/util@0.2.2

## 0.2.1

### Patch Changes

- 23cc154: Updated READMEs and contribution guide
- Updated dependencies [23cc154]
  - @moonwall/util@0.2.1

## 0.2.0

### Major Changes

- 84fee94: ### :warning: This will likely be super buggy for an initial release, whilst we iron out the wrinkles

  - Initial release of `moonwall/util` functions library.
  - Contains constants and useful functions when writing scripts and testing moonbeam networks.

### Patch Changes

- Updated dependencies [84fee94]
  - @moonwall/util@0.2.0
