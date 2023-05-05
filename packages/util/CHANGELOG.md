# @moonwall/util

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
