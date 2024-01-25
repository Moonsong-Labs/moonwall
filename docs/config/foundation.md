# Foundation Parameters by Type

Here are the parameters that you can configure in your Moonwall Config file when setting up your Foundations.

## Generic Foundation Spec

- **name** *string*: The name of the launch spec.
- **running** *boolean*: Optional. This is currently UNUSED.
- **options** *string[]*: Optional. An array of options for the launch spec.

## Dev

- **binPath** *string*: The path to the binary file.
- **disableDefaultEthProviders** *boolean*: Optional. Determines if the default Ethereum provider connections should be disabled. When set to true, the framework will not automatically connect the Ethereum providers. Default behavior is to connect with Ethers, Viem & Web3 frameworks. Note: This also acts as a feature gate for context methods like createTxn and readPrecompile.
- **newRpcBehaviour** *boolean*: Optional. Launch node using rpc-port parameter instead of ws-port.

- **ports** *object*: Optional. An object with p2pPort, rpcPort, and wsPort.
	- **p2pPort** *number*: The port for peer-to-peer (P2P) communication.
	- **rpcPort** *number*: The port for remote procedure call (RPC).
	- **wsPort** *number*: The port for WebSocket communication (soon deprecated).

- **retainAllLogs** *boolean*: Optional. An optional flag to retain node logs from previous runs.

## Read Only 

- **rateLimiter** *boolean* or Bottleneck.ConstructorOptions: Optional. Rate limiter options, on by default. Can be set to false to disable.
- **disableRuntimeVersionCheck** *boolean*: Optional. Disable runtime version check. Runtime Version check is enabled by default.


## Zombie

- **additionalZombieConfig** *OrcOptionsInterface*: Optional. Additional configuration for the zombie network.
- **disableDefaultEthProviders** *boolean*: Optional. Determines if the default Ethereum provider connections should be disabled. When set to true, the framework will not automatically connect the Ethereum providers. Default behavior is to connect with Ethers, Viem & Web3 frameworks.
- **disableLogEavesdropping** *boolean*: Optional. Specifies whether the framework should eavesdrop and log WARN, ERROR from the node logs. If set to true, the eavesdropping on node logs is disabled. Default behavior is to listen to the logs.
- **configPath** *string*: The path to the config file.
- **skipBlockCheck** *string[]*: Optional. An array of blocks to skip checking.


## Chopsticks

- **configPath** *string*: The path to the config file.
- **wsPort** *number*: An optional WebSocket port. Note that this port option is only for single mode, not xcm, in Chopsticks.
- **type** *relaychain* or *parachain*:  An optional type of either "relaychain" or "parachain".
- **wasmOverride** *string*: An optional WebAssembly override.
- **allowUnresolvedImports** *boolean*: An optional flag to NOT throw when the host fails to export a function expected by the runtime.
- **buildBlockMode** *batch*, *manual*, or *instant*: An optional block building mode, can be "batch", "manual" or "instant". This is only supported for single mode chopsticks.
- **retainAllLogs** *boolean*: An optional flag to retain node logs from previous runs.