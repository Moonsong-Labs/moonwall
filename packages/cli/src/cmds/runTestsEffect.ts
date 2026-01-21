/**
 * Effect-based implementation of the test command.
 *
 * This module provides Effect programs for test execution with typed error handling
 * and structured error messages. Effect.runPromise is used at the CLI boundary
 * to maintain backwards compatibility with the Promise-based API.
 *
 * @module runTestsEffect
 */

import { Effect, Cause, Data, Layer } from "effect";
import type { Environment, MoonwallConfig } from "@moonwall/types";
import chalk from "chalk";
import path from "node:path";
import { createLogger } from "@moonwall/util";
import {
  ConfigService,
  ConfigLoadError,
  EnvironmentNotFoundError,
} from "../internal/effect/services/ConfigService.js";
import { ConfigServiceLive } from "../internal/effect/services/ConfigServiceLive.js";
import { withTestSpan, withSpan } from "../internal/effect/Tracing.js";

const logger = createLogger({ name: "runner-effect" });

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when a test-related operation fails.
 */
export class TestCommandError extends Data.TaggedError("TestCommandError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly environmentName?: string;
}> {}

/**
 * Error thrown when test execution itself fails.
 */
export class TestExecutionError extends Data.TaggedError("TestExecutionError")<{
  readonly message: string;
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
}> {}

/**
 * Error thrown when no test files match the given pattern.
 */
export class NoTestFilesError extends Data.TaggedError("NoTestFilesError")<{
  readonly message: string;
  readonly pattern: string;
}> {}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Arguments for the test command Effect program.
 */
export interface TestCmdEffectArgs {
  readonly envName: string;
  readonly testNamePattern?: string;
  readonly subDirectory?: string;
  readonly shard?: string;
  readonly update?: boolean;
  readonly silent?: boolean;
  readonly vitestPassthroughArgs?: string[];
  readonly bunTestPassthroughArgs?: string[];
  readonly onOutputLine?: (line: string) => void;
}

/**
 * Result from the test command Effect program.
 */
export interface TestCmdResult {
  readonly success: boolean;
  readonly message: string;
}

// ============================================================================
// Effect Programs
// ============================================================================

/**
 * Load and validate the environment configuration.
 *
 * This Effect program:
 * 1. Loads the moonwall configuration using ConfigService
 * 2. Retrieves the specified environment
 * 3. Returns both the config and environment
 *
 * @param envName - The name of the environment to load
 */
export const loadEnvironment = (envName: string) =>
  Effect.gen(function* () {
    const configService = yield* ConfigService;

    // Load configuration
    const config = yield* configService.loadConfig().pipe(
      Effect.catchTag("ConfigLoadError", (error) =>
        Effect.fail(
          new TestCommandError({
            message: `Failed to load configuration: ${error.message}`,
            cause: error,
          })
        )
      )
    );

    // Get the specific environment
    const env = yield* configService.getEnvironment(envName).pipe(
      Effect.catchTag("EnvironmentNotFoundError", (error) =>
        Effect.fail(
          new TestCommandError({
            message: formatEnvironmentNotFoundError(error),
            environmentName: envName,
          })
        )
      ),
      Effect.catchTag("ConfigLoadError", (error) =>
        Effect.fail(
          new TestCommandError({
            message: error.message,
            cause: error,
          })
        )
      )
    );

    return { config, env };
  }).pipe(
    // Add tracing span for environment loading
    withTestSpan("setup", envName)
  );

/**
 * Format an EnvironmentNotFoundError into a user-friendly message.
 */
function formatEnvironmentNotFoundError(error: EnvironmentNotFoundError): string {
  const envList = error.availableEnvironments
    ? [...error.availableEnvironments].sort().join(", ")
    : "none";
  return `No environment found in config for: ${chalk.bgWhiteBright.blackBright(
    error.environmentName
  )}\n Environments defined in config are: ${envList}\n`;
}

/**
 * Create the test command Effect program.
 *
 * This is the main Effect program that can be composed with other Effects
 * or run directly using Effect.runPromise at the CLI boundary.
 *
 * The program:
 * 1. Loads configuration and validates the environment
 * 2. Sets up environment variables
 * 3. (Delegates test execution to the existing executeTests function)
 *
 * Note: This returns an Effect that yields the loaded environment and config,
 * allowing the caller to proceed with test execution using the existing
 * Promise-based executeTests function.
 */
export const testCmdEffect = (args: TestCmdEffectArgs) =>
  Effect.gen(function* () {
    // Load and validate environment
    const { config, env } = yield* loadEnvironment(args.envName);

    // Set environment variable for test context
    process.env.MOON_TEST_ENV = args.envName;

    return {
      config,
      env,
      args,
    };
  }).pipe(
    // Add tracing span for the entire test command execution
    withTestSpan("execution", args.envName, {
      pattern: args.testNamePattern,
    })
  );

/**
 * Format a TestCommandError for CLI display.
 *
 * Produces user-friendly error messages with visual formatting
 * that work well in terminal output.
 */
export function formatTestCommandError(error: TestCommandError): string {
  const prefix = chalk.red("❌ Error:");
  return `${prefix} ${error.message}`;
}

/**
 * Format any error from the test command for CLI display.
 *
 * Handles all error types that can occur during test execution
 * and produces appropriate user-friendly messages.
 */
export function formatCliError(error: unknown): string {
  if (error instanceof TestCommandError) {
    return formatTestCommandError(error);
  }
  if (error instanceof TestExecutionError) {
    return `${chalk.red("❌ Tests failed:")} ${error.message} (exit code: ${error.exitCode})`;
  }
  if (error instanceof NoTestFilesError) {
    return `${chalk.red("❌ No tests found:")} ${error.message}`;
  }
  if (error instanceof ConfigLoadError) {
    return `${chalk.red("❌ Configuration error:")} ${error.message}`;
  }
  if (error instanceof EnvironmentNotFoundError) {
    return formatTestCommandError(
      new TestCommandError({
        message: formatEnvironmentNotFoundError(error),
        environmentName: error.environmentName,
      })
    );
  }
  if (error instanceof Error) {
    return `${chalk.red("❌ Error:")} ${error.message}`;
  }
  return `${chalk.red("❌ Error:")} ${String(error)}`;
}

/**
 * Create the Layer for the test command Effect program.
 *
 * This combines all service dependencies needed to run the test command.
 */
export const TestCmdLive = ConfigServiceLive;

/**
 * Run the test command Effect program with error handling.
 *
 * This is the entry point that converts the Effect to a Promise
 * at the CLI boundary. It handles all errors and produces
 * user-friendly messages.
 *
 * @param args - The test command arguments
 * @returns A promise that resolves to the loaded config and environment, or null on error
 */
export async function runTestCmdEffect(
  args: TestCmdEffectArgs
): Promise<{ config: MoonwallConfig; env: Environment; args: TestCmdEffectArgs } | null> {
  const program = testCmdEffect(args).pipe(
    Effect.provide(TestCmdLive),
    Effect.catchAll((error) => {
      // Log the user-friendly error message
      logger.error(formatCliError(error));
      return Effect.succeed(null);
    })
  );

  return Effect.runPromise(program);
}
