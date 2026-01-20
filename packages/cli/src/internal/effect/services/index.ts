/**
 * High-level Effect services for Moonwall foundation management.
 *
 * These services provide Effect-based interfaces for managing blockchain foundations.
 * They wrap lower-level services (ProcessManagerService, PortDiscoveryService, etc.)
 * and provide a consistent, testable interface for foundation lifecycle operations.
 *
 * Service hierarchy:
 * - DevFoundationService: Manages dev/local Substrate nodes
 * - ChopsticksFoundationService: Manages Chopsticks fork instances (planned)
 * - ZombieFoundationService: Manages Zombienet networks (planned)
 * - ReadOnlyFoundationService: Manages read-only connections (planned)
 */

export {
  DevFoundationService,
  type DevFoundationConfig,
  type DevFoundationRunningInfo,
  type DevFoundationStatus,
  type DevFoundationServiceType,
} from "./DevFoundationService.js";
