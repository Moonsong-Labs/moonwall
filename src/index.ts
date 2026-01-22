/**
 * Moonwall - Blockchain Testing Framework
 *
 * Public API exports for test consumers
 */

// =============================================================================
// Type Definitions
// =============================================================================
export * from "./api/types/index.js";

// =============================================================================
// Vitest Re-exports
// =============================================================================
export { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";

// =============================================================================
// Testing Utilities
// =============================================================================
// Block creation, event filtering, contract helpers, etc.
export * from "./util/index.js";

// =============================================================================
// Test Runner
// =============================================================================
// describeSuite - Primary test suite creation function
export { describeSuite } from "./cli/lib/runnerContext.js";

// Configuration loading
export {
  getEnvironmentFromConfig,
  importAsyncConfig,
  importConfig,
  isEthereumDevConfig,
  isEthereumZombieConfig,
} from "./cli/lib/configReader.js";

// =============================================================================
// Context (Advanced Use)
// =============================================================================
// For advanced users who need direct access to the Moonwall context
export { MoonwallContext, contextCreator } from "./cli/lib/globalContext.js";
