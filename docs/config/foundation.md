# Foundation Parameters by Type

Here are the parameters that you can configure in your Moonwall Config file when setting up your Foundations.

## Common Foundation Parameters

*The following parameters are applicable to all foundation types:*
- **name** *string*: The name of the launch spec.
- **running** *boolean*: Optional. This is currently UNUSED.
- **options** *string[]*: Optional. An array of options for the launch spec.

## Foundation-Specific Parameters

*The following parameters are specific to each foundation type:*

### Dev

- **binPath** *string*: The path to the node bin that gets executed to run a network locally.
- **disableDefaultEthProviders** *boolean*: Optional. Determines if the default Ethereum provider connections should be disabled. When set to true, the framework will not automatically connect the Ethereum providers. Default behavior is to connect with Ethers, Viem & Web3 frameworks. Note: This also acts as a feature gate for context methods like createTxn and readPrecompile.
- **newRpcBehaviour** *boolean*: Optional. Launch node using rpc-port parameter instead of ws-port. Any node built on [polkadot-SDK v1+](https://github.com/paritytech/polkadot-sdk){target=blank} will need to set this value to true.
- **ports** *object*: Optional. An object with p2pPort, rpcPort, and wsPort. In most cases, you can omit this. In fact, if your environment is multithreaded, you will have to omit this so that Moonwall can automatically assign multiple concurrent ports.
	- **p2pPort** *number*: The port for peer-to-peer (P2P) communication.
	- **rpcPort** *number*: The port for remote procedure call (RPC).
	- **wsPort** *number*: The port for WebSocket communication (soon deprecated).


- **retainAllLogs** *boolean*: Optional. An optional flag to retain node logs from previous runs. The default behavior is to keep only the last run's logs. (e.g. default behavior is that logs are overwritten unless otherwise specified)

### Read Only 

- **rateLimiter** *boolean* or Bottleneck. ConstructorOptions: Optional. Rate limiter options, on by default. Can be set to false to disable.
- **disableRuntimeVersionCheck** *boolean*: Optional. When set to true, Moonwall will read the runtime name and version from the chain metadata for purposes of test filtering. E.g. You want a particular subset of tests to only run for specific runtimes or runtime versions. If the option is omitted, runtime check is enabled. 

### Zombie

- **additionalZombieConfig** *OrcOptionsInterface*: Optional. Additional configuration for the zombie network.
- **disableDefaultEthProviders** *boolean*: Optional. Determines if the default Ethereum provider connections should be disabled. When set to true, the framework will not automatically connect the Ethereum providers. Default behavior is to connect with Ethers, Viem & Web3 frameworks.
- **disableLogEavesdropping** *boolean*: Optional. Specifies whether the framework should eavesdrop and log WARN, ERROR from the node logs. If set to true, the eavesdropping on node logs is disabled. Default behavior is to listen to the logs.
- **configPath** *string*: The path to the Zombienet config file. See the [Zombienet network definition](https://paritytech.github.io/zombienet/network-definition-spec.html){target=blank} spec for more information.
- **skipBlockCheck** *string[]*: Optional. An array of blocks to skip checking.


### Chopsticks

- **configPath** *string*: The path to the [Chopsticks](https://github.com/AcalaNetwork/chopsticks){target=blank} config file.
- **wsPort** *number*: An optional WebSocket port. Note that this port option is only for single mode, not xcm, in Chopsticks.
- **type** *relaychain* or *parachain*:  An optional type of either "relaychain" or "parachain".
- **wasmOverride** *string*: Optionally override the runtime of a chain with a path to a local instance of another runtime.
- **allowUnresolvedImports** *boolean*: An optional flag to NOT throw when the host fails to export a function expected by the runtime.
::: tip
In most cases you'll want **allowUnresolvedImports** to be set to true. Otherwise, Chopsticks may throw strange errors due to upstream bugs with [Smoldot](https://github.com/smol-dot/smoldot){target=blank}
:::
- **buildBlockMode** *batch*, *manual*, or *instant*: An optional block building mode, can be "batch", "manual" or "instant". This is only supported for single mode chopsticks.
- **retainAllLogs** *boolean*: An optional flag to retain node logs from previous runs.