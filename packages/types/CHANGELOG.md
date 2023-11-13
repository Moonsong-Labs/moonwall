# @moonwall/types

## 4.4.0

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

### Patch Changes

- cc9e654: Chopsticks fix

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

## 4.0.15

### Patch Changes

- 127a97d: Tanssi upgrades

  - Upgrading the artifact downloader to work for tanssi's non-semver release names
  - Added new context properties for `dev`` foundations
    - `pjsApi`: Default getter for PolkadotJs ApiPromise
    - `isEthereumChain` : Getter for whether chain is AccountId20 or not
    - `isSubstrateChain` : Default getter for whether chain is AccountId32 or not
    - `keyring`: Returns an object containing the default accounts (alice, bob)

## 4.0.14

### Patch Changes

- 8d7ae2a: August Update
  - [#231](https://github.com/Moonsong-Labs/moonwall/issues/231)
  - [#92](https://github.com/Moonsong-Labs/moonwall/issues/92)
  - [#223](https://github.com/Moonsong-Labs/moonwall/issues/223)
  - [#226](https://github.com/Moonsong-Labs/moonwall/issues/226)
  - [#225](https://github.com/Moonsong-Labs/moonwall/issues/225)

## 4.0.11

### Patch Changes

- 96a442b: Rate Limiter
  - [#222](https://github.com/Moonsong-Labs/moonwall/issues/222)

## 4.0.10

### Patch Changes

- 4445814: Pkg updates
- dd80fec: Pkg Updates

## 4.0.8

### Patch Changes

- ef3641a: Deps Upgrade

## 4.0.7

### Patch Changes

- 7bf49d8: Small Fixes

## 4.0.5

### Patch Changes

- 86703ac: Updated pkgs

## 4.0.3

### Patch Changes

- 0c70af6: Better CI

## 4.0.1

### Patch Changes

- 6015a4d: SMall fix

## 4.0.0

### Minor Changes

- 8b486d2: added createTransaction to context
  - [#184](https://github.com/Moonsong-Labs/moonwall/issues/184)
  - [#185](https://github.com/Moonsong-Labs/moonwall/issues/185)
  - [#172](https://github.com/Moonsong-Labs/moonwall/issues/172)
  - [#169](https://github.com/Moonsong-Labs/moonwall/issues/169)
  - [#187](https://github.com/Moonsong-Labs/moonwall/issues/187)

## 3.0.11

### Patch Changes

- 63aab7e: Added log saving
  - [#175](https://github.com/Moonsong-Labs/moonwall/issues/175)

## 3.0.10

### Patch Changes

- f914550: Fix download

## 3.0.9

### Patch Changes

- f9f30de: Extended run cmd
  - [#174](https://github.com/Moonsong-Labs/moonwall/issues/174)

## 3.0.8

### Patch Changes

- f983dc9: GetApi fix

## 3.0.7

### Patch Changes

- f121ac7: pushing all pkgs

## 3.0.6

### Patch Changes

- fc81d29: Pkg update

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
