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

// =============================================================================
// RPC Utilities
// =============================================================================
export { customDevRpcRequest } from "./cli/lib/rpcFunctions.js";

// =============================================================================
// Contract Utilities
// =============================================================================
export {
  fetchCompiledContract,
  deployCreateCompiledContract,
  interactWithContract,
  interactWithPrecompileContract,
} from "./cli/lib/contractFunctions.js";

// =============================================================================
// Governance Utilities
// =============================================================================
export {
  whiteListedTrack,
  notePreimage,
  instantFastTrack,
  execCouncilProposal,
  execTechnicalCommitteeProposal,
  execOpenTechCommitteeProposal,
  proposeReferendaAndDeposit,
  dispatchAsGeneralAdmin,
} from "./cli/lib/governanceProcedures.js";

// =============================================================================
// Re-exports from Dependencies (for convenience)
// =============================================================================
export { ApiPromise } from "@polkadot/api";
export { default as Web3 } from "web3";
