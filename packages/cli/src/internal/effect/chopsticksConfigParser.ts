/**
 * Chopsticks Config Parser
 *
 * Parses chopsticks YAML config files and resolves environment variables,
 * providing early validation before attempting to launch.
 */

import { Effect } from "effect";
import * as fs from "node:fs";
import * as yaml from "yaml";
import { ChopsticksSetupError, type ChopsticksConfig } from "./ChopsticksService.js";
// Import type only to avoid loading chopsticks module (which initializes loggers)
import type { BuildBlockMode } from "@acala-network/chopsticks";
import { createLogger } from "@moonwall/util";

// Local values to avoid value import from chopsticks
const BuildBlockModeValues = {
  Batch: "Batch" as BuildBlockMode,
  Manual: "Manual" as BuildBlockMode,
  Instant: "Instant" as BuildBlockMode,
};

const logger = createLogger({ name: "chopsticksConfigParser" });

/**
 * Raw config as it appears in the YAML file
 */
interface RawChopsticksYamlConfig {
  endpoint?: string;
  block?: string | number;
  port?: number;
  "mock-signature-host"?: boolean;
  "wasm-override"?: string;
  "allow-unresolved-imports"?: boolean;
  "build-block-mode"?: string;
  db?: string;
  "import-storage"?: Record<string, Record<string, unknown>>;
  "runtime-log-level"?: number;
}

/**
 * Resolve environment variable references in a string
 * Supports ${env.VAR_NAME} syntax
 */
const resolveEnvVars = (value: string): string => {
  return value.replace(/\$\{env\.([^}]+)\}/g, (_, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      logger.warn(`Environment variable ${varName} is not set`);
      return "";
    }
    return envValue;
  });
};

/**
 * Recursively resolve environment variable references in any value.
 * - Strings: resolves ${env.VAR_NAME} patterns
 * - Arrays: recursively processes each element
 * - Objects: recursively processes each value
 * - Other types (numbers, booleans, null, undefined): returned as-is
 */
const resolveEnvVarsDeep = <T>(value: T): T => {
  if (typeof value === "string") {
    return resolveEnvVars(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(resolveEnvVarsDeep) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolveEnvVarsDeep(val);
    }
    return result as T;
  }
  return value;
};

/**
 * Parse build block mode string to enum
 */
const parseBuildBlockMode = (mode?: string): BuildBlockMode => {
  switch (mode?.toLowerCase()) {
    case "batch":
      return BuildBlockModeValues.Batch;
    case "instant":
      return BuildBlockModeValues.Instant;
    case "manual":
    default:
      return BuildBlockModeValues.Manual;
  }
};

/**
 * Parse the block field which can be a number, block hash string, or env var.
 * Returns undefined if the value is empty or unset.
 */
const parseBlockField = (block: string | number | undefined): string | number | undefined => {
  if (block === undefined || block === null) {
    return undefined;
  }

  // Already a number, return as-is
  if (typeof block === "number") {
    return block;
  }

  // Empty string means env var wasn't set
  if (block === "") {
    return undefined;
  }

  // Try to convert to number (block number)
  const blockNum = Number(block);
  if (!Number.isNaN(blockNum)) {
    return blockNum;
  }

  // It's a block hash (string like "0x...")
  return block;
};

/**
 * Parse a chopsticks YAML config file and return a validated ChopsticksConfig
 */
export const parseChopsticksConfigFile = (
  configPath: string,
  overrides?: {
    port?: number;
    host?: string;
    buildBlockMode?: "batch" | "manual" | "instant";
    wasmOverride?: string;
    allowUnresolvedImports?: boolean;
  }
): Effect.Effect<ChopsticksConfig, ChopsticksSetupError> =>
  Effect.gen(function* () {
    // Read the config file
    const fileContent = yield* Effect.tryPromise({
      try: async () => {
        const content = await fs.promises.readFile(configPath, "utf-8");
        return content;
      },
      catch: (cause) =>
        new ChopsticksSetupError({
          cause,
          endpoint: `file://${configPath}`,
        }),
    });

    // Parse YAML
    const rawConfigUnresolved = yield* Effect.try({
      try: () => yaml.parse(fileContent) as RawChopsticksYamlConfig,
      catch: (cause) =>
        new ChopsticksSetupError({
          cause: new Error(`Failed to parse YAML config: ${cause}`),
          endpoint: `file://${configPath}`,
        }),
    });

    // Resolve all environment variables throughout the config
    const rawConfig = resolveEnvVarsDeep(rawConfigUnresolved);

    // Validate endpoint
    const endpoint = rawConfig.endpoint ?? "";
    if (!endpoint) {
      return yield* Effect.fail(
        new ChopsticksSetupError({
          cause: new Error(
            `Endpoint is required but not configured. ` +
              `Check that the environment variable in your chopsticks config is set. ` +
              `Raw value: "${rawConfigUnresolved.endpoint ?? ""}"`
          ),
          endpoint: rawConfigUnresolved.endpoint || "undefined",
        })
      );
    }

    if (!endpoint.startsWith("ws://") && !endpoint.startsWith("wss://")) {
      return yield* Effect.fail(
        new ChopsticksSetupError({
          cause: new Error(
            `Invalid endpoint format: "${endpoint}" - must start with ws:// or wss://`
          ),
          endpoint,
        })
      );
    }

    // Parse block field (handles number conversion)
    const block = parseBlockField(rawConfig.block);

    logger.debug(`Parsed chopsticks config from ${configPath}`);
    logger.debug(`  endpoint: ${endpoint}`);
    logger.debug(`  port: ${overrides?.port ?? rawConfig.port ?? 8000}`);

    // Build the config
    const config: ChopsticksConfig = {
      endpoint,
      block,
      port: overrides?.port ?? rawConfig.port ?? 8000,
      host: overrides?.host ?? "127.0.0.1",
      buildBlockMode:
        parseBuildBlockMode(overrides?.buildBlockMode) ??
        parseBuildBlockMode(rawConfig["build-block-mode"]),
      wasmOverride: overrides?.wasmOverride ?? rawConfig["wasm-override"],
      allowUnresolvedImports:
        overrides?.allowUnresolvedImports ?? rawConfig["allow-unresolved-imports"],
      mockSignatureHost: rawConfig["mock-signature-host"],
      db: rawConfig.db,
      importStorage: rawConfig["import-storage"],
      runtimeLogLevel: rawConfig["runtime-log-level"],
    };

    return config;
  });

/**
 * Validate a ChopsticksConfig object
 */
export const validateChopsticksConfig = (
  config: ChopsticksConfig
): Effect.Effect<ChopsticksConfig, ChopsticksSetupError> =>
  Effect.gen(function* () {
    if (!config.endpoint) {
      return yield* Effect.fail(
        new ChopsticksSetupError({
          cause: new Error("Endpoint is required - check your environment variables"),
          endpoint: config.endpoint ?? "undefined",
        })
      );
    }

    if (!config.endpoint.startsWith("ws://") && !config.endpoint.startsWith("wss://")) {
      return yield* Effect.fail(
        new ChopsticksSetupError({
          cause: new Error(
            `Invalid endpoint format: "${config.endpoint}" - must start with ws:// or wss://`
          ),
          endpoint: config.endpoint,
        })
      );
    }

    return config;
  });
