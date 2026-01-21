/**
 * Effect Schema definitions for Moonwall configuration validation.
 *
 * These schemas provide runtime validation with TypeScript type inference,
 * enabling:
 * - Type-safe validation with detailed error messages
 * - Automatic type inference from schemas
 * - JSON Schema generation for tooling support
 *
 * @module
 */
import { Schema } from "effect";

// ============================================================================
// Primitive Schemas
// ============================================================================

/**
 * Schema for Ethereum transaction types.
 */
export const EthTransactionTypeSchema = Schema.Literal("eip1559", "eip2930", "legacy");

/**
 * Schema for provider types.
 */
export const ProviderTypeSchema = Schema.Literal("polkadotJs", "ethers", "web3", "viem", "papi");

/**
 * Schema for foundation types.
 */
export const FoundationTypeSchema = Schema.Literal("dev", "chopsticks", "zombie", "read_only");

/**
 * Schema for zombie node types.
 */
export const ZombieNodeTypeSchema = Schema.Literal("relaychain", "parachain");

/**
 * Schema for chopsticks chain types.
 */
export const ChopsticksChainTypeSchema = Schema.Literal("relaychain", "parachain");

/**
 * Schema for chopsticks build block modes.
 */
export const BuildBlockModeSchema = Schema.Literal("batch", "manual", "instant");

/**
 * Schema for default signer types.
 */
export const SignerTypeSchema = Schema.Literal("ethereum", "sr25519", "ed25519");

// ============================================================================
// Helper Types Schemas
// ============================================================================

/**
 * Schema for generic data (key-value string pairs).
 */
export const GenericDataSchema = Schema.Record({
  key: Schema.String,
  value: Schema.String,
});

/**
 * Schema for types bundle.
 */
export const TypesBundleSchema = Schema.Record({
  key: Schema.String,
  value: GenericDataSchema,
});

/**
 * Schema for RPC parameter definitions.
 */
export const RpcParamSchema = Schema.Struct({
  name: Schema.String,
  type: Schema.String,
  isOptional: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

/**
 * Schema for RPC method definitions.
 */
export const RpcMethodSchema = Schema.Struct({
  description: Schema.String,
  params: Schema.Array(RpcParamSchema),
  type: Schema.String,
});

/**
 * Schema for RPC module (method name -> method definition).
 */
export const RpcModuleSchema = Schema.Record({
  key: Schema.String,
  value: RpcMethodSchema,
});

/**
 * Schema for RPC bundle (module name -> module definition).
 */
export const RpcBundleSchema = Schema.Record({
  key: Schema.String,
  value: RpcModuleSchema,
});

/**
 * Schema for binary specifications in repo definitions.
 */
export const BinSchema = Schema.Struct({
  name: Schema.String,
  defaultArgs: Schema.optional(Schema.Array(Schema.String)),
});

/**
 * Schema for repository specifications.
 */
export const RepoSpecSchema = Schema.Struct({
  name: Schema.String,
  ghAuthor: Schema.String,
  ghRepo: Schema.String,
  binaries: Schema.Array(BinSchema),
});

/**
 * Schema for skip test specifications.
 */
export const SkipTestSpecSchema = Schema.Struct({
  name: Schema.String,
  reason: Schema.String,
  since: Schema.String,
});

/**
 * Schema for fork configuration.
 */
export const ForkConfigSchema = Schema.Struct({
  url: Schema.String,
  blockHash: Schema.optional(Schema.String),
  stateOverridePath: Schema.optional(Schema.String),
  verbose: Schema.optional(Schema.Boolean),
});

/**
 * Schema for default signer configuration.
 */
export const DefaultSignerSchema = Schema.Struct({
  type: SignerTypeSchema,
  privateKey: Schema.String,
});

// ============================================================================
// Provider Configuration Schemas
// ============================================================================

/**
 * Schema for provider configuration.
 */
export const ProviderConfigSchema = Schema.Struct({
  name: Schema.String,
  type: ProviderTypeSchema,
  endpoints: Schema.Array(Schema.String),
  rpc: Schema.optional(RpcBundleSchema),
  additionalTypes: Schema.optional(TypesBundleSchema),
  cacheMetadata: Schema.optional(Schema.Boolean),
});

// ============================================================================
// Launch Specification Schemas
// ============================================================================

/**
 * Schema for generic launch specification fields (common to all launch specs).
 */
const GenericLaunchSpecFields = {
  name: Schema.String,
  running: Schema.optional(Schema.Boolean),
  options: Schema.optional(Schema.Array(Schema.String)),
  legacy: Schema.optional(Schema.Boolean),
};

/**
 * Schema for read-only launch specification.
 */
export const ReadOnlyLaunchSpecSchema = Schema.Struct({
  ...GenericLaunchSpecFields,
  rateLimiter: Schema.optional(
    Schema.Union(Schema.Boolean, Schema.Record({ key: Schema.String, value: Schema.Unknown }))
  ),
  disableRuntimeVersionCheck: Schema.optional(Schema.Boolean),
});

/**
 * Schema for Docker configuration.
 */
export const DockerConfigSchema = Schema.Struct({
  runArgs: Schema.optional(Schema.Array(Schema.String)),
  containerName: Schema.optional(Schema.String),
  network: Schema.optional(Schema.String),
  exposePorts: Schema.optional(
    Schema.Array(
      Schema.Struct({
        hostPort: Schema.Number,
        internalPort: Schema.Number,
      })
    )
  ),
});

/**
 * Schema for port configuration.
 */
export const PortsConfigSchema = Schema.Struct({
  p2pPort: Schema.Number,
  rpcPort: Schema.Number,
  wsPort: Schema.Number,
});

/**
 * Schema for dev launch specification.
 */
export const DevLaunchSpecSchema = Schema.Struct({
  ...GenericLaunchSpecFields,
  binPath: Schema.String,
  cacheStartupArtifacts: Schema.optional(Schema.Boolean),
  startupCacheDir: Schema.optional(Schema.String),
  useDocker: Schema.optional(Schema.Boolean),
  dockerConfig: Schema.optional(DockerConfigSchema),
  disableDefaultEthProviders: Schema.optional(Schema.Boolean),
  newRpcBehaviour: Schema.optional(Schema.Boolean),
  defaultForkConfig: Schema.optional(ForkConfigSchema),
  ports: Schema.optional(PortsConfigSchema),
  retainAllLogs: Schema.optional(Schema.Boolean),
});

/**
 * Schema for orchestrator options.
 */
export const OrcOptionsSchema = Schema.Struct({
  monitor: Schema.optional(Schema.Boolean),
  spawnConcurrency: Schema.optional(Schema.Number),
  inCI: Schema.optional(Schema.Boolean),
  dir: Schema.optional(Schema.String),
  force: Schema.optional(Schema.Boolean),
  logType: Schema.optional(Schema.String),
  setGlobalNetwork: Schema.optional(Schema.Unknown),
});

/**
 * Schema for zombie launch specification.
 */
export const ZombieLaunchSpecSchema = Schema.Struct({
  ...GenericLaunchSpecFields,
  additionalZombieConfig: Schema.optional(OrcOptionsSchema),
  disableDefaultEthProviders: Schema.optional(Schema.Boolean),
  disableLogEavesdropping: Schema.optional(Schema.Boolean),
  configPath: Schema.String,
  skipBlockCheck: Schema.optional(Schema.Array(Schema.String)),
});

/**
 * Schema for chopsticks launch specification.
 */
export const ChopsticksLaunchSpecSchema = Schema.Struct({
  ...GenericLaunchSpecFields,
  configPath: Schema.String,
  wsPort: Schema.optional(Schema.Number),
  type: Schema.optional(ChopsticksChainTypeSchema),
  wasmOverride: Schema.optional(Schema.String),
  allowUnresolvedImports: Schema.optional(Schema.Boolean),
  buildBlockMode: Schema.optional(BuildBlockModeSchema),
  retainAllLogs: Schema.optional(Schema.Boolean),
  address: Schema.optional(Schema.String),
  newBlockTimeout: Schema.optional(Schema.Number),
});

// ============================================================================
// Foundation Schemas (Discriminated Union)
// ============================================================================

/**
 * Schema for dev foundation.
 */
export const DevFoundationSchema = Schema.Struct({
  type: Schema.Literal("dev"),
  launchSpec: Schema.Array(DevLaunchSpecSchema),
});

/**
 * Schema for chopsticks foundation.
 */
export const ChopsticksFoundationSchema = Schema.Struct({
  type: Schema.Literal("chopsticks"),
  rtUpgradePath: Schema.optional(Schema.String),
  launchSpec: Schema.Array(ChopsticksLaunchSpecSchema),
});

/**
 * Schema for zombie foundation.
 */
export const ZombieFoundationSchema = Schema.Struct({
  type: Schema.Literal("zombie"),
  rtUpgradePath: Schema.optional(Schema.String),
  zombieSpec: ZombieLaunchSpecSchema,
});

/**
 * Schema for read-only foundation.
 */
export const ReadOnlyFoundationSchema = Schema.Struct({
  type: Schema.Literal("read_only"),
  launchSpec: ReadOnlyLaunchSpecSchema,
});

/**
 * Schema for foundation (discriminated union by 'type' field).
 */
export const FoundationSchema = Schema.Union(
  DevFoundationSchema,
  ChopsticksFoundationSchema,
  ZombieFoundationSchema,
  ReadOnlyFoundationSchema
);

// ============================================================================
// Environment Schema
// ============================================================================

/**
 * Schema for environment configuration.
 */
export const EnvironmentSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  reporters: Schema.optional(Schema.Array(Schema.String)),
  reportFile: Schema.optional(
    Schema.Union(Schema.String, Schema.Record({ key: Schema.String, value: Schema.String }))
  ),
  printTestRunnerOptions: Schema.optional(Schema.Boolean),
  timeout: Schema.optional(Schema.Number),
  testFileDir: Schema.Array(Schema.String),
  envVars: Schema.optional(Schema.Array(Schema.String)),
  foundation: FoundationSchema,
  include: Schema.optional(Schema.Array(Schema.String)),
  connections: Schema.optional(Schema.Array(ProviderConfigSchema)),
  maxConcurrency: Schema.optional(Schema.Union(Schema.Boolean, Schema.Number)),
  cacheImports: Schema.optional(Schema.Boolean),
  contracts: Schema.optional(Schema.String),
  runScripts: Schema.optional(Schema.Array(Schema.String)),
  defaultSigner: Schema.optional(DefaultSignerSchema),
  defaultAllowFailures: Schema.optional(Schema.Boolean),
  defaultFinalization: Schema.optional(Schema.Boolean),
  skipTests: Schema.optional(Schema.Array(SkipTestSpecSchema)),
  bunTestArgs: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

// ============================================================================
// MoonwallConfig Schema
// ============================================================================

/**
 * Schema for the main Moonwall configuration.
 */
export const MoonwallConfigSchema = Schema.Struct({
  $schema: Schema.optional(Schema.String),
  label: Schema.String,
  defaultTestTimeout: Schema.Number,
  scriptsDir: Schema.optional(Schema.String),
  environments: Schema.Array(EnvironmentSchema),
  additionalRepos: Schema.optional(Schema.Array(RepoSpecSchema)),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

/**
 * Type inferred from MoonwallConfigSchema.
 * Use this for type-safe config handling with validated data.
 */
export type MoonwallConfigFromSchema = Schema.Schema.Type<typeof MoonwallConfigSchema>;

/**
 * Type inferred from EnvironmentSchema.
 */
export type EnvironmentFromSchema = Schema.Schema.Type<typeof EnvironmentSchema>;

/**
 * Type inferred from FoundationSchema.
 */
export type FoundationFromSchema = Schema.Schema.Type<typeof FoundationSchema>;

/**
 * Type inferred from ProviderConfigSchema.
 */
export type ProviderConfigFromSchema = Schema.Schema.Type<typeof ProviderConfigSchema>;

/**
 * Type inferred from DevLaunchSpecSchema.
 */
export type DevLaunchSpecFromSchema = Schema.Schema.Type<typeof DevLaunchSpecSchema>;

/**
 * Type inferred from ChopsticksLaunchSpecSchema.
 */
export type ChopsticksLaunchSpecFromSchema = Schema.Schema.Type<typeof ChopsticksLaunchSpecSchema>;

/**
 * Type inferred from ZombieLaunchSpecSchema.
 */
export type ZombieLaunchSpecFromSchema = Schema.Schema.Type<typeof ZombieLaunchSpecSchema>;

/**
 * Type inferred from ReadOnlyLaunchSpecSchema.
 */
export type ReadOnlyLaunchSpecFromSchema = Schema.Schema.Type<typeof ReadOnlyLaunchSpecSchema>;
