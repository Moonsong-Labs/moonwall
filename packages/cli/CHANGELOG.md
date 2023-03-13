# @moonwall/cli

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
