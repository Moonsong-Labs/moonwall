/**
 * Structured Error Logging for Moonwall CLI
 *
 * This module provides centralized error logging utilities using Effect's Cause
 * for comprehensive error information. It enables:
 * - Full error context with stack traces via Cause.pretty
 * - Error categorization (startup, connection, test, cleanup)
 * - Sensitive data filtering to prevent credential leaks
 * - User-friendly actionable error messages
 *
 * @module ErrorLogging
 */

import { Cause, Effect, Data, Chunk } from "effect";
import chalk from "chalk";

// ============================================================================
// Error Categories
// ============================================================================

/**
 * Categories for error classification.
 * Used for organizing log output and filtering in monitoring systems.
 */
export type ErrorCategory =
  | "startup" // Foundation/service initialization errors
  | "connection" // Provider/network connection errors
  | "test" // Test execution errors
  | "cleanup" // Shutdown/cleanup errors
  | "config" // Configuration validation errors
  | "timeout" // Operation timeout errors
  | "process" // Process management errors
  | "unknown"; // Uncategorized errors

/**
 * Structured error information for logging.
 */
export interface StructuredError {
  /** Error category for classification */
  readonly category: ErrorCategory;
  /** Primary error message */
  readonly message: string;
  /** Error tag/type if available (e.g., "FoundationStartupError") */
  readonly errorTag?: string;
  /** Detailed description from the error */
  readonly details?: string;
  /** Suggestions for resolving the error */
  readonly suggestions?: ReadonlyArray<string>;
  /** Filtered stack trace */
  readonly stackTrace?: string;
  /** Timestamp when the error occurred */
  readonly timestamp: string;
  /** Additional context (with sensitive data filtered) */
  readonly context?: Record<string, unknown>;
}

// ============================================================================
// Sensitive Data Patterns
// ============================================================================

/**
 * Patterns that indicate sensitive data that should be redacted.
 */
const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /access[_-]?token/i,
  /bearer[_-]?token/i,
  /auth[_-]?token/i,
  /refresh[_-]?token/i,
  /jwt/i,
  // Credentials
  /password/i,
  /passwd/i,
  /credential/i,
  /private[_-]?key/i,
  /priv[_-]?key/i,
  /mnemonic/i,
  /seed[_-]?phrase/i,
  // Environment variables that typically contain secrets
  /MOON_PRIV_KEY/i,
  /ALITH_PRIVATE_KEY/i,
  /BALTATHAR_PRIVATE_KEY/i,
  /CHARLETH_PRIVATE_KEY/i,
  /DOROTHY_PRIVATE_KEY/i,
  /ETHAN_PRIVATE_KEY/i,
];

/**
 * Value patterns that look like secrets and should be redacted.
 */
const SECRET_VALUE_PATTERNS = [
  // Hex strings that look like private keys (64 hex chars)
  /^0x[a-fA-F0-9]{64}$/,
  // Base64 encoded values that look like tokens (40+ chars)
  /^[A-Za-z0-9+/=]{40,}$/,
  // JWT tokens
  /^eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/,
];

/**
 * Check if a key name suggests it contains sensitive data.
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Check if a value looks like a secret.
 */
function looksLikeSecret(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Redact sensitive values in an object recursively.
 * Returns a new object with sensitive values replaced with "[REDACTED]".
 */
export function redactSensitiveData<T>(obj: T, depth = 0): T {
  // Prevent infinite recursion
  if (depth > 10) return obj;

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return (looksLikeSecret(obj) ? "[REDACTED]" : obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1)) as T;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return result as T;
  }

  return obj;
}

// ============================================================================
// Error Categorization
// ============================================================================

/**
 * Determine the error category from an error object.
 */
export function categorizeError(error: unknown): ErrorCategory {
  if (!error || typeof error !== "object") return "unknown";

  const tag = "_tag" in error ? String((error as { _tag: unknown })._tag) : "";

  // Startup errors
  if (
    tag.includes("Startup") ||
    tag.includes("Launch") ||
    tag.includes("ConfigError") ||
    tag.includes("ConfigLoad") ||
    tag.includes("ConfigValidation")
  ) {
    return "startup";
  }

  // Connection errors
  if (tag.includes("Connection") || tag.includes("Provider") || tag.includes("HealthCheck")) {
    return "connection";
  }

  // Test errors
  if (tag.includes("Test") || tag.includes("NoTestFiles")) {
    return "test";
  }

  // Cleanup/shutdown errors
  if (tag.includes("Shutdown") || tag.includes("Disconnect") || tag.includes("Cleanup")) {
    return "cleanup";
  }

  // Config errors
  if (tag.includes("Config")) {
    return "config";
  }

  // Timeout errors
  if (tag.includes("Timeout")) {
    return "timeout";
  }

  // Process errors
  if (tag.includes("Process") || tag.includes("NodeLaunch") || tag.includes("Port")) {
    return "process";
  }

  return "unknown";
}

/**
 * Get the error tag from an error object.
 */
function getErrorTag(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("_tag" in error && typeof (error as { _tag: unknown })._tag === "string") {
    return (error as { _tag: string })._tag;
  }
  if (error instanceof Error) {
    return error.constructor.name;
  }
  return undefined;
}

/**
 * Get the error message from an error object.
 */
function getErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";

  if (typeof error === "string") return error;

  if (typeof error === "object") {
    // Prefer userMessage (more user-friendly) over message
    if (
      "userMessage" in error &&
      typeof (error as { userMessage: unknown }).userMessage === "string"
    ) {
      return (error as { userMessage: string }).userMessage;
    }
    if ("message" in error && typeof (error as { message: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
  }

  return String(error);
}

/**
 * Extract context from error object (with sensitive data filtered).
 */
function extractContext(error: unknown): Record<string, unknown> | undefined {
  if (!error || typeof error !== "object") return undefined;

  const context: Record<string, unknown> = {};
  const skipKeys = new Set(["_tag", "message", "cause", "stack"]);

  for (const [key, value] of Object.entries(error)) {
    if (!skipKeys.has(key) && value !== undefined) {
      context[key] = value;
    }
  }

  if (Object.keys(context).length === 0) return undefined;

  return redactSensitiveData(context);
}

// ============================================================================
// Suggestions Generator
// ============================================================================

/**
 * Generate actionable suggestions based on error type.
 */
function generateSuggestions(
  error: unknown,
  category: ErrorCategory
): ReadonlyArray<string> | undefined {
  const tag = getErrorTag(error);
  const suggestions: string[] = [];

  switch (category) {
    case "startup":
      if (tag?.includes("ConfigLoad")) {
        suggestions.push("Check that moonwall.config.json exists and is valid JSON");
        suggestions.push("Run 'moonwall init' to generate a new configuration");
      } else if (tag?.includes("ConfigValidation")) {
        suggestions.push("Review the configuration file for missing required fields");
        suggestions.push("Check the JSON Schema for valid configuration options");
      } else {
        suggestions.push("Check that the node binary is available and executable");
        suggestions.push("Verify the node configuration is correct");
        suggestions.push("Increase the startup timeout in moonwall.config.json");
      }
      break;

    case "connection":
      suggestions.push("Check that the endpoint is reachable");
      suggestions.push("Verify the RPC server is running");
      suggestions.push("Check for network/firewall issues");
      if (tag?.includes("HealthCheck")) {
        suggestions.push("Verify the service is still running");
      }
      break;

    case "test":
      if (tag?.includes("NoTestFiles")) {
        suggestions.push("Check the test file patterns in moonwall.config.json");
        suggestions.push("Verify test files exist in the configured directory");
      } else {
        suggestions.push("Review the test failure output for details");
        suggestions.push("Run with --verbose for more debugging information");
      }
      break;

    case "cleanup":
      suggestions.push("Some resources may not have been fully released");
      suggestions.push("Check for orphaned processes with 'ps aux | grep moonbeam'");
      suggestions.push("Ports may still be in use - wait a moment before restarting");
      break;

    case "timeout":
      suggestions.push("The operation took longer than the configured timeout");
      suggestions.push("Increase the timeout value in moonwall.config.json");
      suggestions.push("Check system resources (CPU, memory, disk I/O)");
      break;

    case "process":
      suggestions.push("Check that the process has permission to run");
      suggestions.push("Verify required ports are available");
      suggestions.push("Check system logs for additional details");
      break;

    default:
      break;
  }

  return suggestions.length > 0 ? suggestions : undefined;
}

// ============================================================================
// Core Logging Functions
// ============================================================================

/**
 * Convert an error to a StructuredError for logging.
 */
export function toStructuredError(error: unknown): StructuredError {
  const category = categorizeError(error);
  const errorTag = getErrorTag(error);
  const message = getErrorMessage(error);
  const suggestions = generateSuggestions(error, category);
  const context = extractContext(error);

  // Get stack trace
  let stackTrace: string | undefined;
  if (error instanceof Error && error.stack) {
    stackTrace = error.stack;
  }

  return {
    category,
    message,
    errorTag,
    suggestions,
    stackTrace,
    timestamp: new Date().toISOString(),
    context,
  };
}

/**
 * Format a StructuredError for console output with colors.
 */
export function formatStructuredError(structured: StructuredError): string {
  const lines: string[] = [];

  // Header with category badge
  const categoryBadge = getCategoryBadge(structured.category);
  const errorType = structured.errorTag ? chalk.dim(`[${structured.errorTag}]`) : "";
  lines.push(`${categoryBadge} ${chalk.red(structured.message)} ${errorType}`);

  // Details (if different from message)
  if (structured.details && structured.details !== structured.message) {
    lines.push(chalk.gray(`  ${structured.details}`));
  }

  // Context
  if (structured.context && Object.keys(structured.context).length > 0) {
    lines.push("");
    lines.push(chalk.yellow("Context:"));
    for (const [key, value] of Object.entries(structured.context)) {
      const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
      lines.push(chalk.gray(`  ${key}: ${displayValue}`));
    }
  }

  // Suggestions
  if (structured.suggestions && structured.suggestions.length > 0) {
    lines.push("");
    lines.push(chalk.cyan("Suggestions:"));
    for (const suggestion of structured.suggestions) {
      lines.push(chalk.gray(`  → ${suggestion}`));
    }
  }

  return lines.join("\n");
}

/**
 * Get a colored badge for an error category.
 */
function getCategoryBadge(category: ErrorCategory): string {
  const badges: Record<ErrorCategory, string> = {
    startup: chalk.bgRed.white(" STARTUP "),
    connection: chalk.bgYellow.black(" CONNECTION "),
    test: chalk.bgMagenta.white(" TEST "),
    cleanup: chalk.bgBlue.white(" CLEANUP "),
    config: chalk.bgCyan.black(" CONFIG "),
    timeout: chalk.bgYellow.black(" TIMEOUT "),
    process: chalk.bgRed.white(" PROCESS "),
    unknown: chalk.bgGray.white(" ERROR "),
  };
  return badges[category];
}

/**
 * Format a StructuredError for JSON logging (machine-readable).
 */
export function formatStructuredErrorJson(structured: StructuredError): string {
  return JSON.stringify(structured, null, 2);
}

// ============================================================================
// Effect Cause Integration
// ============================================================================

/**
 * Format an Effect Cause using Cause.pretty for comprehensive error display.
 *
 * This provides the full error tree including:
 * - Error messages and types
 * - Stack traces
 * - Nested causes (for sequential failures)
 * - Parallel causes (for concurrent failures)
 *
 * @param cause The Effect Cause to format
 * @returns Formatted string with full error context
 */
export function formatCausePretty<E>(cause: Cause.Cause<E>): string {
  return Cause.pretty(cause, { renderErrorCause: true });
}

/**
 * Extract all errors from an Effect Cause as StructuredErrors.
 *
 * This flattens the Cause tree and converts each error to a StructuredError.
 */
export function causeToStructuredErrors<E>(cause: Cause.Cause<E>): ReadonlyArray<StructuredError> {
  const errors = Chunk.toReadonlyArray(Cause.failures(cause));
  return errors.map((error) => toStructuredError(error));
}

/**
 * Get a summary of an Effect Cause for brief logging.
 *
 * This provides a one-line summary suitable for status displays.
 */
export function causeSummary<E>(cause: Cause.Cause<E>): string {
  if (Cause.isEmpty(cause)) {
    return "No error";
  }

  const failures = Chunk.toReadonlyArray(Cause.failures(cause));
  if (failures.length === 0) {
    // Check for interrupts or defects
    if (Cause.isInterrupted(cause)) {
      return "Operation was interrupted";
    }
    const defects = Chunk.toReadonlyArray(Cause.defects(cause));
    if (defects.length > 0) {
      return `Unexpected error: ${getErrorMessage(defects[0])}`;
    }
    return "Unknown error";
  }

  if (failures.length === 1) {
    return getErrorMessage(failures[0]);
  }

  return `${failures.length} errors occurred: ${failures.map(getErrorMessage).join("; ")}`;
}

// ============================================================================
// CLI Error Logging
// ============================================================================

/**
 * Log an error with full structured context to console.
 *
 * This is the main entry point for error logging in the CLI.
 * It handles both Effect Causes and plain errors.
 *
 * @param error The error to log
 * @param options Logging options
 */
export function logError(
  error: unknown,
  options: {
    /** Include stack trace in output */
    includeStackTrace?: boolean;
    /** Include suggestions for resolution */
    includeSuggestions?: boolean;
    /** Use verbose output */
    verbose?: boolean;
  } = {}
): void {
  const { includeStackTrace = false, includeSuggestions = true, verbose = false } = options;

  const structured = toStructuredError(error);

  console.error("");
  console.error(formatStructuredError(structured));

  if (includeStackTrace && structured.stackTrace) {
    console.error("");
    console.error(chalk.dim("Stack trace:"));
    console.error(chalk.dim(structured.stackTrace));
  }

  if (verbose) {
    console.error("");
    console.error(chalk.dim(`Timestamp: ${structured.timestamp}`));
    console.error(chalk.dim(`Category: ${structured.category}`));
    if (structured.errorTag) {
      console.error(chalk.dim(`Error type: ${structured.errorTag}`));
    }
  }

  console.error("");
}

/**
 * Log an Effect Cause with full context.
 *
 * Uses Cause.pretty for comprehensive error display including:
 * - Full error tree (sequential and parallel)
 * - Stack traces
 * - Nested causes
 *
 * @param cause The Effect Cause to log
 * @param options Logging options
 */
export function logCause<E>(
  cause: Cause.Cause<E>,
  options: {
    /** Include Cause.pretty output */
    includePretty?: boolean;
    /** Include structured breakdown */
    includeStructured?: boolean;
    /** Use verbose output */
    verbose?: boolean;
  } = {}
): void {
  const { includePretty = true, includeStructured = true, verbose = false } = options;

  if (Cause.isEmpty(cause)) {
    return;
  }

  console.error("");

  if (includeStructured) {
    const structured = causeToStructuredErrors(cause);
    for (const error of structured) {
      console.error(formatStructuredError(error));
      console.error("");
    }
  }

  if (includePretty && verbose) {
    console.error(chalk.dim("Full error details:"));
    console.error(chalk.dim(formatCausePretty(cause)));
  }
}

// ============================================================================
// Effect Integration Helpers
// ============================================================================

/**
 * Create an Effect that logs the error and returns the structured error info.
 *
 * This is useful for error handlers that need to log and continue processing.
 */
export const logAndStructure = <E>(error: E): Effect.Effect<StructuredError> =>
  Effect.sync(() => {
    const structured = toStructuredError(error);
    logError(error, { includeSuggestions: true });
    return structured;
  });

/**
 * Create an Effect tap that logs errors without modifying the Effect.
 *
 * Use this in Effect pipelines to add logging at failure points.
 *
 * @example
 * ```ts
 * const program = startFoundation(config).pipe(
 *   Effect.tapError(logErrorEffect({ verbose: true }))
 * );
 * ```
 */
export const logErrorEffect =
  (options: { includeStackTrace?: boolean; verbose?: boolean } = {}) =>
  <E>(error: E): Effect.Effect<void> =>
    Effect.sync(() => {
      logError(error, { ...options, includeSuggestions: true });
    });

/**
 * Format any error (Effect-based or plain) for CLI display.
 *
 * This is an enhanced version of formatCliError that includes
 * error categorization and suggestions.
 */
export function formatErrorForCli(error: unknown): string {
  const structured = toStructuredError(error);
  return formatStructuredError(structured);
}

/**
 * Check if an error should be logged with a stack trace.
 *
 * Stack traces are shown for:
 * - Unknown/unexpected errors
 * - Process errors
 * - Defects (programming errors)
 */
export function shouldIncludeStackTrace(error: unknown): boolean {
  const category = categorizeError(error);
  return category === "unknown" || category === "process";
}

// ============================================================================
// Export type helpers
// ============================================================================

/**
 * Type guard to check if a value is a StructuredError.
 */
export function isStructuredError(value: unknown): value is StructuredError {
  return (
    typeof value === "object" &&
    value !== null &&
    "category" in value &&
    "message" in value &&
    "timestamp" in value
  );
}
