# @moonwall/util

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
