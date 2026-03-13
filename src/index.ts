/**
 * Moonwall - Blockchain Testing Framework
 *
 * Public API exports for test consumers
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const lazyValue = <T extends object>(load: () => T): T => {
  let cached: T | undefined;
  const getValue = () => (cached ??= load());

  return new Proxy(function () {} as unknown as T, {
    get(_target, prop) {
      const loaded = getValue() as Record<PropertyKey, unknown>;
      const value = Reflect.get(loaded, prop, loaded);
      return typeof value === "function" ? value.bind(loaded) : value;
    },
    set(_target, prop, value) {
      return Reflect.set(getValue() as Record<PropertyKey, unknown>, prop, value);
    },
    apply(_target, thisArg, argArray) {
      return Reflect.apply(getValue() as unknown as (...args: unknown[]) => unknown, thisArg, argArray);
    },
    construct(_target, argArray) {
      return Reflect.construct(getValue() as unknown as new (...args: unknown[]) => object, argArray);
    },
    has(_target, prop) {
      return Reflect.has(getValue() as Record<PropertyKey, unknown>, prop);
    },
    ownKeys() {
      return Reflect.ownKeys(getValue() as Record<PropertyKey, unknown>);
    },
    getOwnPropertyDescriptor(_target, prop) {
      return (
        Object.getOwnPropertyDescriptor(getValue() as Record<PropertyKey, unknown>, prop) ?? {
          configurable: true,
          enumerable: true,
        }
      );
    },
  });
};

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
  whiteListTrackNoSend,
  notePreimage,
  instantFastTrack,
  execCouncilProposal,
  execTechnicalCommitteeProposal,
  execOpenTechCommitteeProposal,
  proposeReferendaAndDeposit,
  dispatchAsGeneralAdmin,
  maximizeConvictionVotingOf,
  fastFowardToNextEvent,
} from "./cli/lib/governanceProcedures.js";

// =============================================================================
// Substrate Runtime Primitives
// =============================================================================
// Fixed-point arithmetic types matching sp_runtime (Percent, Perbill, etc.)
export * from "./api/substrate/index.js";

// =============================================================================
// Re-exports from Dependencies (for convenience)
// =============================================================================
export const ApiPromise: typeof import("@polkadot/api").ApiPromise = lazyValue(
  () => (require("@polkadot/api") as typeof import("@polkadot/api")).ApiPromise
);

export const Web3: typeof import("web3").default = lazyValue(() => {
  const web3Module = require("web3") as typeof import("web3");
  return (web3Module.default ?? (web3Module as { Web3: typeof import("web3").default }).Web3) as typeof import("web3").default;
});
