# Common Helpers

## Moonwall Utils

Moonwall Utils is a utils package for Moonwall that includes a suite of constants, functions, classes, and types that are useful when writing tests with Moonwall. 

### Installation

Moonwall Utils can be installed with the following command:

```bash
npm i @moonwall/util
```

### Moonwall Utils Reference

#### Generic Account Constants

Moonwall Utils has a variety of account constants intended for generic substrate networks. A full list of these constants is available in `accounts.js` of the `constants` folder of Moonwall Utils.

The aforementioned account constants include all of the prefunded developer accounts (Alith, Baltathar, Charleth, Dorothy, Ethan, Faith, Gerald, Goliath). These constants include DEBUG_MODE and DISPLAY_LOG for debugging purposes. Paths for the base, custom specifications, binary, and relay binary are configurable through environment variables, accommodating custom or override runtime paths as well as Ethereum API commands.

Token constants are defined in terms of GLMR, (which is equivalent to ETH as both ETH and GLMR have a token decimal precision of 18) setting default balances for genesis, staking (delegating), and proposal amounts. The account constants also include gas and weight per second, limits for block weight and gas, and calculations for extrinsic gas limits and base weights. 

#### Moonbeam-Specific Constants

Moonwall Utils also has constants primarily intended for Moonbeam networks. A full list of these constants is available in `chain.js` of the `constants` folder of Moonwall Utils. `Chain.js` includes various environmental configurations, such as DEBUG_MODE for debugging, DISPLAY_LOG and MOONBEAM_LOG for logging configurations, and several paths (BASE_PATH, CUSTOM_SPEC_PATH, BINARY_PATH, etc.) for specifying the locations of binaries and custom specifications.

Network-specific parameters include the definition of GLMR and its smaller units (MILLIGLMR, MICROGLMR), along with default genesis balances and staking amounts. It also defines the gas economics with constants like WEIGHT_PER_SECOND, GAS_PER_SECOND, and limits for block weight and gas.

Precompile addresses are specified for various functionalities (e.g., parachain staking, crowdloan rewards, native ERC20 handling). Precompiles enable EVM developers to access Moonbeam's powerful substrate features from a Solidity interface in the EVM. 

Additional constants provided include time-related constants such as standard time conversions and block production intervals. Additionally, it details proxy types and contract randomness statuses, offering a framework for contract interactions and governance. Runtime constants are tailored for different Moonbeam networks (Moonbase, Moonriver, Moonbeam), adjusting fee multipliers and base fee limits to suit each network's economic model.


## Artifact Downloader

Moonwall has an integrated artifact downloader that allows you to quickly grab client artifacts that you need, without having to leave the CLI. 

### Using the Artifact Downloader

1. Choose option **4. Artifact Downloader** from the Moonwall main menu.
2. Select from the desired network
3. Select the desired version
4. Enter the directory where you'd like the artifact placed 
5. Review your selections and press enter to start the download

When the download is completed, Moonwall will attempt to launch the binary, but your operating system may prevent this by default. You can mark the file as executable and run the binary for the respective network as you usually do, or Moonwall can run it for you when running your tests.

![screenshot of artifact downloader](/artifact-downloader.png)

### Supported Networks

Artifact Downloader currently supports downloading artifacts for the following networks:

- Moonbeam
- Polkadot
- Tanssi

Would you like to see other networks added here? You can add [your network configuration to `repoDefinitions`](https://github.com/Moonsong-Labs/moonwall/tree/main/packages/cli/src/lib/repoDefinitions){target=_blank}. `YOUR-NETWORK.ts` needs to specify the network's Github repo name, repo owner, and supported binaries. Here's an example of of the repo definition file for Tanssi: 

```typescript
import { RepoSpec } from "@moonwall/types";

const repo: RepoSpec = {
  name: "tanssi",
  binaries: [
    { name: "tanssi-node", defaultArgs: ["--dev", "--sealing=manual", "--no-hardware-benchmarks"] },
    { name: "container-chain-template-simple-node" },
    { name: "container-chain-template-frontier-node" },
  ],
  ghAuthor: "moondance-labs",
  ghRepo: "tanssi",
};
export default repo;
```
