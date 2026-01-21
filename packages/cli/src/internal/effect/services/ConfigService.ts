import { Context, Data, type Effect } from "effect";
import type { MoonwallConfig, Environment } from "@moonwall/types";

/**
 * Error thrown when configuration loading fails.
 *
 * This covers file not found, parse errors, and validation failures.
 *
 * @example
 * ```ts
 * Effect.catchTag("ConfigLoadError", (error) => {
 *   console.error(`Failed to load config: ${error.message}`);
 * })
 * ```
 */
export class ConfigLoadError extends Data.TaggedError("ConfigLoadError")<{
  /** Human-readable error message */
  readonly message: string;
  /** The path that was attempted to be loaded */
  readonly configPath?: string;
  /** The underlying cause of the error */
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when configuration validation fails.
 *
 * @example
 * ```ts
 * Effect.catchTag("ConfigValidationError", (error) => {
 *   console.error(`Invalid config at ${error.invalidField}: ${error.message}`);
 * })
 * ```
 */
export class ConfigValidationError extends Data.TaggedError("ConfigValidationError")<{
  /** Human-readable error message */
  readonly message: string;
  /** The specific configuration field that is invalid */
  readonly invalidField?: string;
  /** The invalid value that was provided */
  readonly invalidValue?: unknown;
  /** The path to the config file */
  readonly configPath?: string;
}> {}

/**
 * Error thrown when an environment is not found in configuration.
 *
 * @example
 * ```ts
 * Effect.catchTag("EnvironmentNotFoundError", (error) => {
 *   console.error(`Environment "${error.environmentName}" not found`);
 * })
 * ```
 */
export class EnvironmentNotFoundError extends Data.TaggedError("EnvironmentNotFoundError")<{
  /** The name of the environment that was not found */
  readonly environmentName: string;
  /** Human-readable error message */
  readonly message: string;
  /** Available environment names for help text */
  readonly availableEnvironments?: ReadonlyArray<string>;
}> {}

/**
 * Configuration for the ConfigService.
 */
export interface ConfigServiceConfig {
  /** Path to the configuration file (absolute or relative to cwd) */
  readonly configPath?: string;
}

/**
 * Status of the ConfigService.
 */
export type ConfigServiceStatus =
  | { readonly _tag: "Unloaded" }
  | { readonly _tag: "Loading" }
  | { readonly _tag: "Loaded"; readonly configPath: string }
  | { readonly _tag: "Failed"; readonly error: unknown };

/**
 * ConfigService provides Effect-based configuration loading and validation
 * for Moonwall test environments.
 *
 * This service handles:
 * - Loading moonwall.config.json (or .config for JSONC)
 * - Environment variable substitution in config values
 * - Caching the loaded configuration
 * - Looking up specific environments by name
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { ConfigService } from "./ConfigService.js";
 *
 * const program = Effect.gen(function* () {
 *   const configService = yield* ConfigService;
 *
 *   // Load the configuration
 *   const config = yield* configService.loadConfig();
 *   console.log(`Loaded config: ${config.label}`);
 *
 *   // Get a specific environment
 *   const env = yield* configService.getEnvironment("dev_seq");
 *   console.log(`Foundation type: ${env.foundation.type}`);
 * });
 * ```
 */
export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  {
    /**
     * Load the Moonwall configuration from disk.
     *
     * If the configuration has already been loaded, returns the cached version.
     * Environment variables in the format `${VAR_NAME}` are replaced with
     * their actual values.
     *
     * @param config - Optional configuration specifying the config file path
     * @returns Effect yielding the loaded MoonwallConfig
     *
     * @example
     * ```ts
     * const config = yield* configService.loadConfig();
     * // Or with custom path
     * const config = yield* configService.loadConfig({ configPath: "./custom.config.json" });
     * ```
     */
    readonly loadConfig: (
      config?: ConfigServiceConfig
    ) => Effect.Effect<MoonwallConfig, ConfigLoadError>;

    /**
     * Get the current cached configuration without loading from disk.
     *
     * @returns Effect yielding the cached config, or ConfigLoadError if not loaded
     */
    readonly getConfig: () => Effect.Effect<MoonwallConfig, ConfigLoadError>;

    /**
     * Check if configuration has been loaded.
     *
     * @returns Effect yielding true if config is loaded, false otherwise
     */
    readonly isLoaded: () => Effect.Effect<boolean>;

    /**
     * Get the current status of the ConfigService.
     *
     * @returns The current status (Unloaded, Loading, Loaded, or Failed)
     */
    readonly getStatus: () => Effect.Effect<ConfigServiceStatus>;

    /**
     * Get a specific environment configuration by name.
     *
     * @param name - The name of the environment to retrieve
     * @returns Effect yielding the Environment, or EnvironmentNotFoundError if not found
     *
     * @example
     * ```ts
     * const env = yield* configService.getEnvironment("dev_seq");
     * console.log(`Test dirs: ${env.testFileDir.join(", ")}`);
     * ```
     */
    readonly getEnvironment: (
      name: string
    ) => Effect.Effect<Environment, ConfigLoadError | EnvironmentNotFoundError>;

    /**
     * Get all environment names from the configuration.
     *
     * @returns Effect yielding an array of environment names
     */
    readonly getEnvironmentNames: () => Effect.Effect<ReadonlyArray<string>, ConfigLoadError>;

    /**
     * Validate the loaded configuration.
     *
     * Performs structural validation of the configuration, checking for:
     * - Required fields (label, environments, defaultTestTimeout)
     * - Valid environment definitions
     * - Valid foundation configurations
     *
     * @returns Effect that succeeds if valid, fails with ConfigValidationError otherwise
     */
    readonly validateConfig: () => Effect.Effect<void, ConfigLoadError | ConfigValidationError>;

    /**
     * Clear the cached configuration.
     *
     * This forces the next loadConfig() call to reload from disk.
     *
     * @returns Effect that completes when cache is cleared
     */
    readonly clearCache: () => Effect.Effect<void>;

    /**
     * Get the path to the configuration file.
     *
     * @returns Effect yielding the config path, or ConfigLoadError if not loaded
     */
    readonly getConfigPath: () => Effect.Effect<string, ConfigLoadError>;
  }
>() {}

export type { ConfigService as ConfigServiceType };
