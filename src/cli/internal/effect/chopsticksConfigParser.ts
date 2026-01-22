/**
 * Chopsticks Config Parser
 *
 * Parses chopsticks YAML config files and resolves environment variables,
 * providing early validation before attempting to launch.
 *
 * This module uses the ChopsticksConfig type directly from @acala-network/chopsticks
 * to ensure we stay in sync with upstream changes and support all config options.
 */

import { Effect } from "effect";
import * as fs from "node:fs";
import * as yaml from "yaml";
import { ChopsticksSetupError, type ChopsticksConfig } from "./ChopsticksService.js";
import type { BuildBlockMode } from "@acala-network/chopsticks";
import { createLogger } from "../../../util/index.js";

// Local values to avoid value import from chopsticks (which initializes loggers)
const BuildBlockModeValues = {
  Batch: "Batch" as BuildBlockMode,
  Manual: "Manual" as BuildBlockMode,
  Instant: "Instant" as BuildBlockMode,
};

const logger = createLogger({ name: "chopsticksConfigParser" });

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
const parseBlockField = (
  block: string | number | null | undefined
): string | number | null | undefined => {
  if (block === undefined || block === null) {
    return block;
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
 * Overrides that can be applied to the parsed config.
 * These use Moonwall's naming conventions from ChopsticksLaunchSpec.
 */
export interface ChopsticksConfigOverrides {
  port?: number;
  host?: string;
  buildBlockMode?: "batch" | "manual" | "instant";
  wasmOverride?: string;
  allowUnresolvedImports?: boolean;
}

/**
 * Parse a chopsticks YAML config file and return a validated ChopsticksConfig.
 *
 * This function:
 * 1. Reads and parses the YAML file
 * 2. Resolves environment variables (${env.VAR_NAME} syntax)
 * 3. Validates required fields
 * 4. Applies any overrides
 * 5. Returns the config in chopsticks' native format (kebab-case keys)
 *
 * The returned config is compatible with chopsticks' setupWithServer function.
 */
export const parseChopsticksConfigFile = (
  configPath: string,
  overrides?: ChopsticksConfigOverrides
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

    // Parse YAML (raw, unprocessed)
    const rawConfigUnresolved = yield* Effect.try({
      try: () => yaml.parse(fileContent) as Record<string, unknown>,
      catch: (cause) =>
        new ChopsticksSetupError({
          cause: new Error(`Failed to parse YAML config: ${cause}`),
          endpoint: `file://${configPath}`,
        }),
    });

    // Resolve all environment variables throughout the config
    const rawConfig = resolveEnvVarsDeep(rawConfigUnresolved);

    // Extract endpoint for validation (may be string or array)
    const rawEndpoint = rawConfig.endpoint;
    const endpoint =
      typeof rawEndpoint === "string"
        ? rawEndpoint
        : Array.isArray(rawEndpoint)
          ? rawEndpoint[0]
          : "";

    if (!endpoint) {
      return yield* Effect.fail(
        new ChopsticksSetupError({
          cause: new Error(
            `Endpoint is required but not configured. ` +
              `Check that the environment variable in your chopsticks config is set. ` +
              `Raw value: "${rawConfigUnresolved.endpoint ?? ""}"`
          ),
          endpoint: String(rawConfigUnresolved.endpoint) || "undefined",
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

    // Parse block field
    const block = parseBlockField(rawConfig.block as string | number | null | undefined);

    // Determine build-block-mode
    const rawBuildBlockMode = rawConfig["build-block-mode"] as string | undefined;
    const buildBlockMode =
      overrides?.buildBlockMode !== undefined
        ? parseBuildBlockMode(overrides.buildBlockMode)
        : rawBuildBlockMode !== undefined
          ? parseBuildBlockMode(rawBuildBlockMode)
          : BuildBlockModeValues.Manual;

    const finalPort = overrides?.port ?? (rawConfig.port as number | undefined) ?? 8000;

    logger.debug(`Parsed chopsticks config from ${configPath}`);
    logger.debug(`  endpoint: ${endpoint}`);
    logger.debug(`  port: ${finalPort}`);

    const config: ChopsticksConfig = {
      ...rawConfig,
      block,
      "build-block-mode": buildBlockMode,
      port: finalPort,
      ...(overrides?.host !== undefined && { host: overrides.host }),
      ...(overrides?.wasmOverride !== undefined && { "wasm-override": overrides.wasmOverride }),
      ...(overrides?.allowUnresolvedImports !== undefined && {
        "allow-unresolved-imports": overrides.allowUnresolvedImports,
      }),
    } as ChopsticksConfig;

    return config;
  });

/**
 * Validate a ChopsticksConfig object
 */
export const validateChopsticksConfig = (
  config: ChopsticksConfig
): Effect.Effect<ChopsticksConfig, ChopsticksSetupError> =>
  Effect.gen(function* () {
    // Extract endpoint (may be string or array)
    const endpoint =
      typeof config.endpoint === "string"
        ? config.endpoint
        : Array.isArray(config.endpoint)
          ? config.endpoint[0]
          : undefined;

    if (!endpoint) {
      return yield* Effect.fail(
        new ChopsticksSetupError({
          cause: new Error("Endpoint is required - check your environment variables"),
          endpoint: "undefined",
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

    return config;
  });
