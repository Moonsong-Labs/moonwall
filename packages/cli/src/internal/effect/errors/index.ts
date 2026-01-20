/**
 * Effect error types for Moonwall
 *
 * This module provides tagged error classes using Effect's Data.TaggedError pattern.
 * These errors are designed to be:
 * - Type-safe with discriminated unions
 * - Catchable with Effect.catchTag
 * - Structurally comparable for testing
 *
 * Error hierarchy:
 * - Foundation errors: High-level errors for foundation lifecycle (start, stop, health)
 * - Provider errors: Errors for blockchain client connections
 * - Process errors: Low-level errors for process management (in ../errors.ts)
 */

// Foundation lifecycle errors
export {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
  FoundationConfigError,
  ProviderConnectionError,
} from "./foundation.js";
