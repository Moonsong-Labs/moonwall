import Bottleneck from "bottleneck";

/**
 * The main configuration object for Moonwall.
 */
export type MoonwallConfig = {
  /**
   * The JSON schema for the config.
   */
  $schema: string;

  /**
   * A label for the config.
   */
  label: string;

  /**
   * The default timeout for tests.
   */
  defaultTestTimeout: number;

  /**
   * Optional path to a directory containing scripts.
   */
  scriptsDir?: string;

  /**
   * An array of Environment objects for testing.
   */
  environments: Environment[];
};

/**
 * The environment configuration for testing.
 */
export type Environment = {
  /**
   * An optional array of reporter names.
   */
  reporters?: string[];

  /**
   * The name of the environment.
   */
  name: string;

  /**
   * An array of directories with test files.
   */
  testFileDir: string[];

  /**
   * An optional array of environment variable names.
   */
  envVars?: string[];

  /**
   * The foundation configuration for the environment.
   */
  foundation: IFoundation;

  /**
   * An optional array of included files or directories.
   */
  include?: string[];

  /**
   * An optional array of ProviderConfig objects.
   */
  connections?: ProviderConfig[];

  /**
   * An optional boolean to indicate if multi-threading is enabled.
   * Turbo is an experimental feature which may cause memory leaks 😰
   */
  multiThreads?: boolean | number | "turbo";

  /**
   * Path to directory containing smart contracts for testing against.
   */
  contracts?: string;

  /**
   * An optional array of scripts to run before testing.
   */
  runScripts?: string[];

  /**
   * The privateKey with which to sign and send transactions in createBlock() function.
   */
  defaultSigner?: {
    /**
     *  Substrate Keyring type
     */
    type: "ethereum" | "sr25519" | "ed25519";
    /**
     * Hex encoded private key to generate KeyringPair ("0x..")
     */
    privateKey: string;
  };

  /**
   * Toggle whether createBlock() will throw when extrinsic errors inside.
   */
  defaultAllowFailures?: boolean;

  /**
   * Toggle whether createBlock() will finalize blocks by default or not.
   */
  defaultFinalization?: boolean;
};

/**
 * @name IFoundation
 * @description The foundation configuration for the environment. It can be of several types including "dev", "chopsticks", "zombie", "read_only", or "fork".
 */
export type IFoundation =
  | {
      type: "dev";
      launchSpec: DevLaunchSpec[];
    }
  | {
      type: "chopsticks";
      rtUpgradePath?: string;
      launchSpec: ChopsticksLaunchSpec[];
    }
  | {
      type: "zombie";
      rtUpgradePath?: string;
      zombieSpec: ZombieLaunchSpec;
    }
  | {
      type: "read_only";
      launchSpec: ReadOnlyLaunchSpec;
    }
  | {
      type: "fork";
      // launchSpec: ForkLaunchSpec;
    };

/**
 * @name EthTransactionType
 * @description The type of Ethereum transaction. Can be "Legacy", "EIP2930", or "EIP1559".
 */
export type EthTransactionType = (typeof EthTransactionTypes)[number];

export const EthTransactionTypes = ["eip1559", "eip2930", "legacy"] as const;

/**
 * @name FoundationType
 * @description The type of foundation configuration. It can be of several types including "dev", "chopsticks", "zombie", "read_only", or "fork".
 */
export type FoundationType = IFoundation["type"];

/**
 * A generic launch specification object.
 */
export interface GenericLaunchSpec {
  /**
   * The name of the launch spec.
   */
  name: string;

  /**
   * UNUSED
   */
  running?: boolean;

  /**
   * An optional array of options for the launch spec.
   */
  options?: string[];
}

/**
 * A launch specification object for the "read_only" foundation type.
 * @extends GenericLaunchSpec
 */
export interface ReadOnlyLaunchSpec extends GenericLaunchSpec {
  /**
   * Rate limiter options, on by default.
   * Can be set to false to disable.
   */
  rateLimiter?: boolean | Bottleneck.ConstructorOptions;
}

/**
 * A launch specification object for the "fork" foundation type.
 * @extends GenericLaunchSpec
 */
export interface ForkLaunchSpec extends GenericLaunchSpec {}

/**
 * A launch specification object for the "zombie" foundation type.
 * @extends GenericLaunchSpec
 */
export interface ZombieLaunchSpec extends GenericLaunchSpec {
  /**
   * Determines if the default Ethereum provider connections should be disabled.
   * When set to true, the framework will not automatically connect the Ethereum providers.
   * Default behavior (when unset or set to false) is to connect with Ethers, Viem & Web3 frameworks.
   */
  disableDefaultEthProviders?: boolean;

  /**
 * Specifies whether the framework should eavesdrop and log WARN, ERROR from the node logs.
 * If set to true, the eavesdropping on node logs is disabled. 
 * Default behavior (when unset or set to false) is to listen to the logs.
 */
  disableLogEavesdropping?: boolean;

  /**
   * The path to the config file.
   */
  configPath: string;

  /**
   * An optional monitored node.
   */
  monitoredNode?: string;

  /**
   * An optional array of blocks to skip checking.
   */
  skipBlockCheck?: string[];
}

// TODO: Separate single chopsticks network and multi chopsticks into separate interfaces
/**
 * A launch specification object for the "chopsticks" foundation type.
 * @extends GenericLaunchSpec
 */
export interface ChopsticksLaunchSpec extends GenericLaunchSpec {
  /**
   * The path to the config file.
   */
  configPath: string;

  /**
   * An optional WebSocket port.
   * Quirk of Chopsticks is that port option is only for single mode not xcm.
   */
  wsPort?: number;

  /**
   * An optional type of either "relaychain" or "parachain".
   */
  type?: "relaychain" | "parachain";

  /**
   * An optional WebAssembly override.
   */
  wasmOverride?: string;

  /**
   * An optional block building mode, can be "batch", "manual" or "instant".
   * This is only supported for single mode chopsticks.
   */
  buildBlockMode?: "batch" | "manual" | "instant";
}

/**
 * A launch specification object for the "dev" foundation type.
 * @extends GenericLaunchSpec
 */
export interface DevLaunchSpec extends GenericLaunchSpec {
  /**
   * The path to the binary file.
   */
  binPath: string;

  /**
   * Determines if the default Ethereum provider connections should be disabled.
   * When set to true, the framework will not automatically connect the Ethereum providers.
   * Default behavior (when unset or set to false) is to connect with Ethers, Viem & Web3 frameworks.
   *
   * Note: This also acts as a feature gate for context methods like createTxn and readPrecompile.
   */
  disableDefaultEthProviders?: boolean;

  /**
   * Launch node using rpc-port parameter instead of ws-port.
   */
  newRpcBehaviour?: boolean;

  /**
   * An optional flag to retain node logs from previous runs.
   */
  retainAllLogs?: boolean;

  /**
   * An optional object with p2pPort, wsPort, and rpcPort.
   */
  ports?: {
    /**
     * The port for peer-to-peer (P2P) communication.
     */
    p2pPort: number;

    /**
     * The port for remote procedure call (RPC).
     */
    rpcPort: number;

    /**
     * The port for WebSocket communication (soon deprecated)
     */
    wsPort: number;
  };
}

/**
 * The configuration object for a provider.
 */
export interface ProviderConfig {
  /**
   * The name of the provider.
   */
  name: string;

  /**
   * The type of the provider.
   */
  type: ProviderType;

  /**
   * An array of endpoint URLs.
   */
  endpoints: string[];

  /**
   * An optional RPC bundle.
   */
  rpc?: IRpcBundle;

  /**
   * An optional collection of additional types.
   */
  additionalTypes?: TypesBundle;
}

/**
 * @name ProviderType
 * @description The type of provider. Can be "polkadotJs", "ethers", "web3", "viem"
 */
export type ProviderType = "polkadotJs" | "ethers" | "web3" | "viem";

/**
 * @name ZombieNodeType
 * @description The type of Zombie node. Can be "relaychain" or "parachain
 */
export type ZombieNodeType = "relaychain" | "parachain";

/**
 * @name IRpcParam
 * @description Interface for defining RPC parameters.
 * @property name - The name of the RPC parameter.
 * @property type - The type of the RPC parameter.
 * @property isOptional - A flag indicating whether the RPC parameter is optional.
 */
export interface IRpcParam {
  name: string;
  type: string;
  isOptional?: boolean;
}

/**
 * @name IRpcMethod
 * @description Interface for defining RPC methods.
 * @property description - A brief description of the RPC method.
 * @property params - An array of IRpcParam defining the parameters of the method.
 * @property type - The return type of the RPC method.
 */
export interface IRpcMethod {
  description: string;
  params: IRpcParam[];
  type: string;
}

/**
 * @name IRpcModule
 * @description Interface for defining RPC modules.
 * It is a dictionary where each key is a method name and the value is an IRpcMethod.
 */
export interface IRpcModule {
  [methodName: string]: IRpcMethod;
}

/**
 * @name IRpcBundle
 * @description Interface for defining RPC bundles.
 * It is a dictionary where each key is a module name and the value is an IRpcModule.
 */
export interface IRpcBundle {
  [moduleName: string]: IRpcModule;
}

/**
 * Represents a collection of GenericData.
 * It's an object where each key is a string and the corresponding value is a GenericData object.
 *
 * @example
 * ```typescript
 * const example: TypesBundle = {
 *   ContainerChainGenesisData: {
 *     id: "Vec<u8>"
 *   }
 * };
 * ```
 */
export type TypesBundle = {
  [key: string]: GenericData;
};

export type GenericData = {
  [key: string]: string;
};
