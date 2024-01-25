# Environment Configuration

You'll need to set up your environment configuration while getting your Moonwall Config file sorted. Let's dive into each of the parameters you can use when setting up your environment.

## Parameters

- **reporters** *string[]*:  an optional array of reporter names
- **reportFile** *string* or *{ [reporterName: string]: string }*: Writes test results to a file when using the HTLM or JSON reporter. You can provide an object instead of a string to define individual outputs when using multiple reporters. 
- **name** *string*: string name of your environment
- **description** *string*:  description of the environment to display in menus
- **timeout** *number*: The default timeout for tests and hooks
- **testFileDir** *string[]*: Array of directories where your test files are held
- **envVars** *string[]*:  An optional array of environment variable names.
- **foundation**: The foundation configuration for the environment.
- **include?** *string[]*:  An optional array included files or directories.
- **connections?** * ProviderConfig[]*: An optional array of ProviderConfig objects.
- **multiThreads?** *boolean*, *number*, or *object*: An optional boolean to indicate if multi-threading is enabled. Optionally, you can specify your own threadPool spec using a PoolOptions config object. See [poolOptions](https://vitest.dev/config/#pooloptions){target=blank} for more info. 
- **contracts?** *string*: Path to directory containing smart contracts for testing against.
- **defaultSigner?** *{Substrate keyring type, privateKey}* Allows you to specify the kind of signer and the private key with which to sign and send transactions during the createBlock() function. The default signer can be of type *ethereum*, *sr25519*, or *ed25519* For more info about each, see [Polkadot Keyring docs](https://polkadot.js.org/docs/keyring/start/sign-verify/){target=blank}
- **defaultAllowFailures?** *boolean*: Toggle whether createBlock() will throw when extrinsic errors inside.
- **defaultFinalization?** *boolean*:Toggle whether createBlock() will finalize blocks by default or not.

### Dev


