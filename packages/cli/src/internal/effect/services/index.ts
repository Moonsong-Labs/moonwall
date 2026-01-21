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
 * - ZombieFoundationService: Manages Zombienet networks (planned)
 * - ReadOnlyFoundationService: Manages read-only connections (planned)
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
