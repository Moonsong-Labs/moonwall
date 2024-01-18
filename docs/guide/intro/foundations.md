# All About Foundations

## What are foundations?

Foundations are bundlings of configurations and presets that will (hopefully) make your life easier by allowing you to quickly execute tests under different assumptions. For more information about each foundation, continue reading below. 

## Foundations Offered

Moonwall offers five different foundations as follows:

### Dev

- The Dev foundation is for running tests on a local development node.
- Assumes manual seal (a block will be produced only when you specifically direct the node to produce one).

### Read only: 

- This option does not start any networks but relies on networks that are already stood up.
- You *can* submit transactions to live networks but it is not recommended as automated tests will quickly drain wallets (even testnet wallets).
- Also used for smoke tests.

### Zombie

- Uses [ParityTech's ZombieNet framework](https://github.com/paritytech/zombienet){target=_blank} to run a multi-node network
- Import a zombienet config file, such as this [ZombieNet example config file](https://paritytech.github.io/zombienet/cli/spawn.html){target=_blank}
- Can launch multiple blockchains, for example, a relaychain with several parachains or multiple ContainerChains with Tanssi.

### Chopsticks:
- Uses [Chopsticks](https://github.com/AcalaNetwork/chopsticks){target=_blank} to start a lazily-forked network. Lazily-forking a network refers to quickly cloning the state of the chosen network. The new fork is on its own and will not import new blocks from the original network. 
- Imports a Chopsticks config file, such as the following [example Chopsticks config](https://github.com/AcalaNetwork/chopsticks/tree/master/configs){target=_blank} 
- You can launch a single blockchain or multiple blockchains
- Performs state transitions locally and updates local state
- No client RPCs, no MetaMask support. This foundation strictly models change of state 

### Fork:

- Coming soon! Will be part of a new way of forking the network with a real client

![Foundation image](/foundation.png)
