# @moonwall/cli

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
