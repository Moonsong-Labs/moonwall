import { Effect, Layer, Ref } from "effect";
import type { MoonwallConfig, Environment } from "@moonwall/types";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path, { extname } from "node:path";
import JSONC from "jsonc-parser";
import {
  ConfigService,
  ConfigLoadError,
  ConfigValidationError,
  EnvironmentNotFoundError,
  type ConfigServiceConfig,
  type ConfigServiceStatus,
} from "./ConfigService.js";

/**
 * Internal state for the ConfigService
 */
interface ConfigServiceState {
  readonly status: ConfigServiceStatus;
  readonly config: MoonwallConfig | undefined;
  readonly configPath: string | undefined;
}

/**
 * Replace environment variable placeholders in configuration values.
 *
 * Processes strings containing `${VAR_NAME}` patterns and replaces them
 * with the corresponding environment variable values.
 *
 * @param value - The value to process
 * @returns The processed value with env vars replaced
 */
function replaceEnvVars(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (match, group) => {
      const envVarValue = process.env[group];
      return envVarValue || match;
    });
  }
  if (Array.isArray(value)) {
    return value.map(replaceEnvVars);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceEnvVars(v)]));
  }
  return value;
}

/**
 * Parse a config file based on its extension.
 *
 * @param filePath - Path to the config file
 * @param content - File content as string
 * @returns Parsed configuration object
 */
function parseConfigContent(filePath: string, content: string): unknown {
  const ext = extname(filePath);
  switch (ext) {
    case ".json":
      return JSON.parse(content);
    case ".config":
      return JSONC.parse(content);
    default:
      throw new Error(`Unsupported config file extension: ${ext}`);
  }
}

/**
 * Resolve the config path to an absolute path.
 *
 * @param configPath - The config path (may be relative)
 * @returns The absolute path
 */
function resolveConfigPath(configPath: string | undefined): string {
  const effectivePath = configPath || process.env.MOON_CONFIG_PATH || "moonwall.config.json";
  return path.isAbsolute(effectivePath) ? effectivePath : path.join(process.cwd(), effectivePath);
}

/**
 * Validate required fields in the configuration.
 */
function validateRequiredFields(
  config: MoonwallConfig,
  configPath: string
): Effect.Effect<void, ConfigValidationError> {
  return Effect.gen(function* () {
    if (!config.label) {
      return yield* Effect.fail(
        new ConfigValidationError({
          message: "Configuration is missing required field: label",
          invalidField: "label",
          configPath,
        })
      );
    }

    if (typeof config.defaultTestTimeout !== "number" || config.defaultTestTimeout <= 0) {
      return yield* Effect.fail(
        new ConfigValidationError({
          message: "Configuration requires a positive defaultTestTimeout",
          invalidField: "defaultTestTimeout",
          invalidValue: config.defaultTestTimeout,
          configPath,
        })
      );
    }

    if (!Array.isArray(config.environments) || config.environments.length === 0) {
      return yield* Effect.fail(
        new ConfigValidationError({
          message: "Configuration requires at least one environment",
          invalidField: "environments",
          invalidValue: config.environments,
          configPath,
        })
      );
    }

    // Validate each environment has required fields
    for (const env of config.environments) {
      if (!env.name) {
        return yield* Effect.fail(
          new ConfigValidationError({
            message: "Environment is missing required field: name",
            invalidField: "environments[].name",
            configPath,
          })
        );
      }

      if (!env.foundation) {
        return yield* Effect.fail(
          new ConfigValidationError({
            message: `Environment "${env.name}" is missing required field: foundation`,
            invalidField: `environments[${env.name}].foundation`,
            configPath,
          })
        );
      }

      if (!env.testFileDir || env.testFileDir.length === 0) {
        return yield* Effect.fail(
          new ConfigValidationError({
            message: `Environment "${env.name}" is missing required field: testFileDir`,
            invalidField: `environments[${env.name}].testFileDir`,
            configPath,
          })
        );
      }
    }
  });
}

/**
 * Live implementation of ConfigService using Effect.
 *
 * This layer provides the production implementation that:
 * - Reads configuration from the filesystem
 * - Parses JSON or JSONC files
 * - Substitutes environment variables
 * - Caches the loaded configuration
 */
export const ConfigServiceLive: Layer.Layer<ConfigService> = Layer.effect(
  ConfigService,
  Effect.gen(function* () {
    // Initialize state with Ref
    const stateRef = yield* Ref.make<ConfigServiceState>({
      status: { _tag: "Unloaded" },
      config: undefined,
      configPath: undefined,
    });

    return {
      loadConfig: (serviceConfig?: ConfigServiceConfig) =>
        Effect.gen(function* () {
          // Check if already loaded (use cached)
          const currentState = yield* Ref.get(stateRef);
          if (currentState.status._tag === "Loaded" && currentState.config) {
            return currentState.config;
          }

          // Set loading status
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            status: { _tag: "Loading" as const },
          }));

          const filePath = resolveConfigPath(serviceConfig?.configPath);

          // Check file exists
          if (!existsSync(filePath)) {
            const error = new ConfigLoadError({
              message: `Configuration file not found: ${filePath}`,
              configPath: filePath,
            });
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              status: { _tag: "Failed" as const, error },
            }));
            return yield* Effect.fail(error);
          }

          // Read and parse the file
          const loadResult = yield* Effect.tryPromise({
            try: async () => {
              const content = await readFile(filePath, "utf8");
              const parsed = parseConfigContent(filePath, content);
              const replaced = replaceEnvVars(parsed);
              return replaced as MoonwallConfig;
            },
            catch: (error) =>
              new ConfigLoadError({
                message: `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
                configPath: filePath,
                cause: error,
              }),
          });

          // Update state with loaded config
          yield* Ref.update(stateRef, () => ({
            status: { _tag: "Loaded" as const, configPath: filePath },
            config: loadResult,
            configPath: filePath,
          }));

          return loadResult;
        }),

      getConfig: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (!state.config) {
            return yield* Effect.fail(
              new ConfigLoadError({
                message: "Configuration has not been loaded. Call loadConfig() first.",
              })
            );
          }
          return state.config;
        }),

      isLoaded: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          return state.status._tag === "Loaded";
        }),

      getStatus: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          return state.status;
        }),

      getEnvironment: (name: string) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (!state.config) {
            return yield* Effect.fail(
              new ConfigLoadError({
                message: "Configuration has not been loaded. Call loadConfig() first.",
              })
            );
          }

          const env = state.config.environments.find((e) => e.name === name);
          if (!env) {
            return yield* Effect.fail(
              new EnvironmentNotFoundError({
                environmentName: name,
                message: `Environment "${name}" not found in configuration`,
                availableEnvironments: state.config.environments.map((e) => e.name),
              })
            );
          }

          return env;
        }),

      getEnvironmentNames: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (!state.config) {
            return yield* Effect.fail(
              new ConfigLoadError({
                message: "Configuration has not been loaded. Call loadConfig() first.",
              })
            );
          }
          return state.config.environments.map((e) => e.name);
        }),

      validateConfig: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (!state.config) {
            return yield* Effect.fail(
              new ConfigLoadError({
                message: "Configuration has not been loaded. Call loadConfig() first.",
              })
            );
          }

          yield* validateRequiredFields(state.config, state.configPath || "unknown");
        }),

      clearCache: () =>
        Ref.update(stateRef, () => ({
          status: { _tag: "Unloaded" as const },
          config: undefined,
          configPath: undefined,
        })),

      getConfigPath: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (!state.configPath) {
            return yield* Effect.fail(
              new ConfigLoadError({
                message: "Configuration has not been loaded. Call loadConfig() first.",
              })
            );
          }
          return state.configPath;
        }),
    };
  })
);

/**
 * Factory function to create a ConfigService layer with custom initial state.
 *
 * Useful for testing scenarios where you want to provide a pre-loaded configuration.
 *
 * @returns A new Layer instance for the ConfigService
 */
export function makeConfigServiceLayer(): Layer.Layer<ConfigService> {
  return ConfigServiceLive;
}
