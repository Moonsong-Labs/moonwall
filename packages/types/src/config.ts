/**
 * @name MoonwallConfig
 * @description The main configuration object for Moonwall.
 * @property $schema - The JSON schema for the config.
 * @property label - A label for the config.
 * @property defaultTestTimeout - The default timeout for tests.
 * @property scriptsDir - Optional path to a directory containing scripts.
 * @property environments - An array of Environment objects for testing.
 */
export type MoonwallConfig = {
  $schema: string;
  label: string;
  defaultTestTimeout: number;
  scriptsDir?: string;
  environments: Environment[];
};

/**
 * @name Environment
 * @description The environment configuration for testing.
 * @property reporters - An optional array of reporter names.
 * @property name - The name of the environment.
 * @property testFileDir - An array of directories with test files.
 * @property envVars - An optional array of environment variable names.
 * @property foundation - The foundation configuration for the environment.
 * @property include - An optional array of included files or directories.
 * @property connections - An optional array of ProviderConfig objects.
 * @property multiThreads - An optional boolean to indicate if multi-threading is enabled.
 * @property defaultEthTxnStyle - An optional default Ethereum transaction type.
 * @property contracts - Path to foundry directory containing smart contracts for testing.
 * @property runScripts - An optional array of scripts to run before testing.
 * @property defaultSigner - A privateKey string to be the default
 */
export type Environment = {
  reporters?: string[];
  name: string;
  testFileDir: string[];
  envVars?: string[];
  foundation: IFoundation;
  include?: string[];
  connections?: ProviderConfig[];
  multiThreads?: boolean | number;
  defaultEthTxnStyle?: EthTransactionType;
  contracts?: string;
  runScripts?: string[];
  defaultSigner?: { type: "ethereum" | "sr25519" | "ed25519"; privateKey: string };
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
      type: "read_only" | "fork";
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
 * @name GenericLaunchSpec
 * @description A generic launch specification object.
 * @property name - The name of the launch spec.
 * @property running - An optional flag indicating if the spec is currently running.
 * @property options - An optional array of options for the launch spec.
 */
export interface GenericLaunchSpec {
  name: string;
  running?: boolean;
  options?: string[];
}

/**
 * @name ZombieLaunchSpec
 * @description A launch specification object for the "zombie" foundation type.
 * @extends GenericLaunchSpec
 * @property configPath - The path to the config file.
 * @property monitoredNode - An optional monitored node.
 * @property skipBlockCheck - An optional array of blocks to skip checking.
 */
export interface ZombieLaunchSpec extends GenericLaunchSpec {
  configPath: string;
  monitoredNode?: string;
  skipBlockCheck?: string[];
}

// TODO: Separate single chopsticks network and multi chopsticks into separate interfaces
/**
 * @name ChopsticksLaunchSpec
 * @description A launch specification object for the "chopsticks" foundation type.
 * @extends GenericLaunchSpec
 * @property configPath - The path to the config file.
 * @property wsPort - An optional WebSocket port.
 * @property type - An optional type of either "relaychain" or "parachain".
 * @property wasmOverride - An optional WebAssembly override.
 * @property buildBlockMode - An optional block building mode, can be "batch", "manual" or "instant".
 */
export interface ChopsticksLaunchSpec extends GenericLaunchSpec {
  configPath: string;
  wsPort?: number; // Quirk of Chopsticks is that port option  only for single mode not xcm
  type?: "relaychain" | "parachain";
  wasmOverride?: string;
  // buildBlockMode only supported for single mode chopsticks
  buildBlockMode?: "batch" | "manual" | "instant";
}

/**
 * @name DevLaunchSpec
 * @description A launch specification object for the "dev" foundation type.
 * @extends GenericLaunchSpec
 * @property binPath - The path to the binary file.
 * @property disableDefaultEthProviders - An optional flag to disable default Ethereum providers.
 * @property ports - An optional object with p2pPort, wsPort, and rpcPort.
 */
export interface DevLaunchSpec extends GenericLaunchSpec {
  binPath: string;
  disableDefaultEthProviders?: boolean;
  ports?: {
    p2pPort: number;
    wsPort: number;
    rpcPort: number;
  };
}

/**
 * @name ProviderConfig
 * @description The configuration object for a provider.
 * @property name - The name of the provider.
 * @property type - The type of the provider.
 * @property endpoints - An array of endpoint URLs.
 * @property rpc - An optional RPC bundle.
 */
export interface ProviderConfig {
  name: string;
  type: ProviderType;
  endpoints: string[];
  rpc?: IRpcBundle;
  additionalTypes?: TypesBundle;
}

// TODO: Make Provider Sub-types (for viem and polkadot.js)
/**
 * @name ProviderType
 * @description The type of provider. Can be "polkadotJs", "ethers", "web3", "moon", "unknown", "viemPublic", or "viemWallet".
 */
export type ProviderType =
  | "polkadotJs"
  | "ethers"
  | "web3"
  | "moon"
  | "unknown"
  | "viemPublic"
  | "viemWallet";

/**
 * @name ViemClientType
 * @description The type of Viem client. Can be "public" or "wallet".
 */
export type ViemClientType = "public" | "wallet";

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
