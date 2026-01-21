/**
 * High-level Effect services for Moonwall foundation management.
 *
 * These services provide Effect-based interfaces for managing blockchain foundations.
 * They wrap lower-level services (ProcessManagerService, PortDiscoveryService, etc.)
 * and provide a consistent, testable interface for foundation lifecycle operations.
 *
 * Service hierarchy:
 * - DevFoundationService: Manages dev/local Substrate nodes
 * - ChopsticksFoundationService: Manages Chopsticks fork instances
 * - ZombieFoundationService: Manages Zombienet multi-node networks
 * - ReadOnlyFoundationService: Manages read-only connections to existing networks
 */

// DevFoundationService interface and types
export {
  DevFoundationService,
  type DevFoundationConfig,
  type DevFoundationRunningInfo,
  type DevFoundationStatus,
  type DevFoundationServiceType,
} from "./DevFoundationService.js";

// DevFoundationService Layer implementations
export {
  DevFoundationServiceLive,
  makeDevFoundationServiceLayer,
} from "./DevFoundationServiceLive.js";

// ChopsticksFoundationService interface and types
export {
  ChopsticksFoundationService,
  type ChopsticksFoundationConfig,
  type ChopsticksFoundationRunningInfo,
  type ChopsticksFoundationStatus,
  type ChopsticksFoundationServiceType,
} from "./ChopsticksFoundationService.js";

// ChopsticksFoundationService Layer implementations
export {
  ChopsticksFoundationServiceLive,
  makeChopsticksFoundationServiceLayer,
} from "./ChopsticksFoundationServiceLive.js";

// ZombieFoundationService interface and types
export {
  ZombieFoundationService,
  ZombieNodeOperationError,
  type ZombieFoundationConfig,
  type ZombieFoundationRunningInfo,
  type ZombieFoundationStatus,
  type ZombieNodeInfo,
  type ZombieNodeType,
  type ZombieFoundationServiceType,
} from "./ZombieFoundationService.js";

// ZombieFoundationService Layer implementations
export {
  ZombieFoundationServiceLive,
  makeZombieFoundationServiceLayer,
} from "./ZombieFoundationServiceLive.js";

// ReadOnlyFoundationService interface and types
export {
  ReadOnlyFoundationService,
  type ReadOnlyFoundationConfig,
  type ReadOnlyFoundationRunningInfo,
  type ReadOnlyFoundationStatus,
  type ReadOnlyFoundationServiceType,
} from "./ReadOnlyFoundationService.js";

// ReadOnlyFoundationService Layer implementations
export {
  ReadOnlyFoundationServiceLive,
  makeReadOnlyFoundationServiceLayer,
} from "./ReadOnlyFoundationServiceLive.js";

// ProviderService interface and types
export {
  ProviderService,
  ProviderDisconnectError,
  ProviderHealthCheckError,
  type ProviderServiceConfig,
  type ProviderServiceRunningInfo,
  type ProviderServiceStatus,
  type TypedConnectedProvider,
  type ProviderServiceType,
} from "./ProviderService.js";

// Unified FoundationService types and factory
export {
  FoundationServiceFactory,
  // Unified types
  type AnyFoundationConfig,
  type AnyFoundationRunningInfo,
  type AnyFoundationStatus,
  type FoundationServiceMap,
  type FoundationConfigMap,
  type FoundationRunningInfoMap,
  type FoundationStatusMap,
  type BaseFoundationLifecycle,
  type FoundationServiceResult,
  type DevFoundationServiceResult,
  type ChopsticksFoundationServiceResult,
  type ZombieFoundationServiceResult,
  type ReadOnlyFoundationServiceResult,
  // Type guards
  isDevFoundationConfig,
  isChopsticksFoundationConfig,
  isZombieFoundationConfig,
  isReadOnlyFoundationConfig,
  isDevFoundationStatus,
  isChopsticksFoundationStatus,
  isZombieFoundationStatus,
  isReadOnlyFoundationStatus,
} from "./FoundationService.js";
