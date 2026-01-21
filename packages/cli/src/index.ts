export * from "@moonwall/types";
export { afterAll, afterEach, beforeAll, beforeEach, expect } from "bun:test";
export * from "./lib/binariesHelpers";
export * from "./lib/configReader";
export * from "./lib/contextHelpers";
export * from "./lib/contextEffect";
export * from "./lib/contractFunctions";
export * from "./lib/globalContext";
export * from "./lib/governanceProcedures";
export * from "./lib/rpcFunctions";
export * from "./lib/runnerContext";

// Re-export Effect services for advanced users
// Note: Types with same names as @moonwall/types are not re-exported to avoid conflicts
export {
  // Foundation services
  DevFoundationService,
  ChopsticksFoundationService,
  ZombieFoundationService,
  ReadOnlyFoundationService,
  // Foundation service layers
  DevFoundationServiceLive,
  ChopsticksFoundationServiceLive,
  ZombieFoundationServiceLive,
  ReadOnlyFoundationServiceLive,
  // Provider service
  ProviderService,
  ProviderServiceLive,
  ProviderDisconnectError,
  ProviderHealthCheckError,
  // Config service
  ConfigService,
  ConfigServiceLive,
  ConfigLoadError,
  ConfigValidationError,
  EnvironmentNotFoundError,
  // Logger service
  LoggerService,
  LoggerServiceLive,
  LoggerServiceDisabled,
  LoggerCreationError,
  // Unified foundation factory
  FoundationServiceFactory,
  // Type guards
  isDevFoundationConfig,
  isChopsticksFoundationConfig,
  isZombieFoundationConfig,
  isReadOnlyFoundationConfig,
  isDevFoundationStatus,
  isChopsticksFoundationStatus,
  isZombieFoundationStatus,
  isReadOnlyFoundationStatus,
} from "./internal/effect/services/index.js";

// Re-export foundation error types
export {
  FoundationStartupError,
  FoundationShutdownError,
  FoundationHealthCheckError,
  FoundationConfigError,
  ProviderConnectionError,
} from "./internal/effect/errors/foundation.js";
