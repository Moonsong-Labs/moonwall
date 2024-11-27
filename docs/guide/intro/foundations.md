# All About Foundations

## What are Foundations?

Foundations are bundlings of configurations and presets that will (hopefully) make your life easier by allowing you to quickly execute tests under different assumptions. For more information about each Foundation, continue reading below. 

## Foundations Offered

Moonwall offers five different Foundations as follows:

### Dev

- The Dev Foundation is for running tests on a local development node.
- Assumes manual seal (a block will be produced only when you specifically direct the node to produce one).
- Moonwall will check to see if you already have a dev node running before trying to start its own. 

::: tip
Dev is great for repeated lightweight testing, e.g. debugging
:::

### Chopsticks:

- Uses [Chopsticks](https://github.com/AcalaNetwork/chopsticks){target=_blank} to start a lazily-forked network. Lazily-forking a network refers to loading the runtime of the live chain but only retrieving state when needed. The major advantage is that spares you from downloading the entire blockchain (hundreds of GBs).
- Imports a Chopsticks config file, such as the following [example Chopsticks config](https://github.com/AcalaNetwork/chopsticks/tree/master/configs){target=_blank}. 
- You can launch a single blockchain or multiple blockchains.
- Performs state transitions locally and updates local state.
- No client RPCs, no MetaMask support. 

::: tip
Chopsticks is ideal for testing runtime upgrades and substrate extrinsics. It's not suited for EVM calls.
:::

### Read only: 

- This option does not start any networks but relies on networks that are already running. This applies to all networks, including local dev nodes, live testnets, and more.
- You *can* submit transactions to live networks but it is not recommended as automated tests will quickly drain wallets (even testnet wallets).
- Also used for smoke tests.

::: tip
Use Read Only if Moonwall doesn't need to start any networks - you've already got it covered.
:::

### Zombie

- Uses [ParityTech's ZombieNet framework](https://github.com/paritytech/zombienet){target=_blank} to start a fresh multi-node network on your local machine.
- Import a zombienet config file, such as this [ZombieNet example config file](https://paritytech.github.io/zombienet/cli/spawn.html){target=_blank}.
- Can launch multiple blockchains, for example, a relaychain with several parachains or multiple ContainerChains with Tanssi.

::: tip
Zombie is the ideal Foundation for testing cross chain interactions including XCM.
:::