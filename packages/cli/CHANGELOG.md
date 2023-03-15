# @moonwall/cli

## 0.2.8

### Patch Changes

- Updated dependencies [515c38e]
  - @moonsong-labs/moonwall-util@0.2.7

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
  - @moonsong-labs/moonwall-util@0.2.6

## 0.2.5

### Patch Changes

- f628150: Disabled auto-forking

  Fork-To-Genesis function has been disabled for the time being until we fix it downstream

- Updated dependencies [f628150]
  - @moonsong-labs/moonwall-util@0.2.5

## 0.2.4

### Patch Changes

- Updated dependencies [e33abc6]
  - @moonsong-labs/moonwall-util@0.2.4

## 0.2.3

### Patch Changes

- 470a9d0: SegFault BugFix
  - Changed usage of Vitest to remove segfaults
    :information_source: N.B. Bug fix means state separation has been affected. Fix for this is coming next
- Updated dependencies [470a9d0]
  - @moonsong-labs/moonwall-util@0.2.3

## 0.2.2

### Patch Changes

- 780429f: Tidied package exports
  - No longer wrapping `ApiPromise` so that it can be augmented as required in test projects
- Updated dependencies [780429f]
  - @moonsong-labs/moonwall-util@0.2.2

## 0.2.1

### Patch Changes

- 23cc154: Updated READMEs and contribution guide
- Updated dependencies [23cc154]
  - @moonsong-labs/moonwall-util@0.2.1

## 0.2.0

### Major Changes

- 84fee94: ### :warning: This will likely be super buggy for an initial release, whilst we iron out the wrinkles

  - Initial release of `moonwall/util` functions library.
  - Contains constants and useful functions when writing scripts and testing moonbeam networks.

### Patch Changes

- Updated dependencies [84fee94]
  - @moonwall/util@0.2.0
