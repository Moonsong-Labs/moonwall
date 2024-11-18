# All About Providers

## What are providers? 

Providers in the context of Moonwall assume the same identity as providers in the greater blockchain development space. A provider is a tool that allows you or your application to connect to a blockchain network and simplifies the low-level details of the process. A provider handles submitting transactions, reading state, and more. 


## Working with Providers

In Moonwall, you can interact with your preferred provider as your normally would. Don't forget to import your provider into your test file and import any relevant helpers, such as `utils` from `ethers` or `ApiPromise` from `@polkadot/api`.

## Providers supported

At time of writing, Moonwall supports the following providers:

### PolkadotJs

PolkadotJs is a suite of tools, including a JavaScript library, for interacting with the Polkadot network and other Substrate-based blockchains. To learn more about PolkadotJs, you can check out the [PolkadotJs docs](https://polkadot.js.org/docs/api/){target=_blank}

### Polkadot-API (PAPI)

[Polkadot-API](https://github.com/polkadot-api/polkadot-api){target=_blank} is a modern, lightweight, and fast alternative to the PolkadotJs library for interacting with Substrate-based blockchains. It is designed to be more performant and have a smaller bundle size compared to PolkadotJs, while maintaining compatibility with the Polkadot ecosystem. For more information about Polkadot-API, check out the [Polkadot-API docs](https://papi.how/){target=_blank}.

### Ethers

[Ethers.js](https://github.com/ethers-io/ethers.js){target=_blank} is a popular and comprehensive JavaScript library used for interacting with the Ethereum-compatible blockchains. It is designed to provide a simple, minimal, and complete interface to EVM-compatible chains. For more information about Ethers, be sure to check out the [Ethers docs](https://docs.ethers.org/v6/){target=_blank}

### Web3

[Web3.js](https://github.com/web3/web3.js){target=_blank} is a popular Ethereum javascript library & competitor to Ethers.js. It takes a slightly different approach to providing all of the necessary functionaity for interacting with Ethereum-compatible blockchains. For more information about Web3.js, be sure to checkout the [Web3js docs](https://web3js.readthedocs.io/en/v1.10.0/){target=_blank}.

### Viem

[Viem](https://github.com/wevm/viem){target=_blank} is a lightweight and modular typescript library for interacting with Ethereum-compatible blockchains. For more information about Viem, be sure to checkout the [Viem docs](https://viem.sh/){target=_blank}. 
