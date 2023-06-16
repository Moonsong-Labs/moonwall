# @moonwall/types

## 3.0.4

### Patch Changes

- 54f03f9: fix for chain upgrading rt2400+

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

## 2.0.3

### Patch Changes

- 116aed0: Updated Pkgs

## 2.0.0

### Minor Changes

- d21fe62: Script support
  - [#74](https://github.com/Moonsong-Labs/moonwall/issues/74)
  - Removed foundry support

## 1.0.4

### Patch Changes

- 7085c51: Tansii Changes
  - [#145](https://github.com/Moonsong-Labs/moonwall/issues/145)

## 1.0.3

### Patch Changes

- 67e0359: Updated Web3

## 1.0.2

### Patch Changes

- 6cd511d: pkg update

## 1.0.1

### Patch Changes

- 50a9887: Speed optimization
  - Updated polkadotJs default args for speed

## 1.0.0

### Minor Changes

- fa3b546: Added forge support
  - [#47](https://github.com/Moonsong-Labs/moonwall/issues/47)
  - [#123](https://github.com/Moonsong-Labs/moonwall/issues/123)
  - [#132](https://github.com/Moonsong-Labs/moonwall/issues/132)
  - [#125](https://github.com/Moonsong-Labs/moonwall/issues/125)

## 0.5.22

### Patch Changes

- 395f803: Updated Pkgs

## 0.5.20

### Patch Changes

- ffe71e9: New Types Repo

  - [#121](https://github.com/Moonsong-Labs/moonwall/issues/121)
  - pkg updates
