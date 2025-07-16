# Moonwall GitHub Issues Analysis

This document analyzes all open GitHub issues for the Moonwall project and rates them by implementation difficulty based on code analysis.

## Summary

- **Total Open Issues**: 12
- **Easy (1-2 days)**: 2 issues
- **Medium (3-5 days)**: 3 issues  
- **Hard (1-2 weeks)**: 3 issues
- **Very Hard (2+ weeks)**: 4 issues

## Issues Rated by Difficulty

### 🟢 EASY (1-2 days)

#### 1. Issue #477: Logger param broken in context.upgradeRuntime
**Difficulty**: Easy  
**Estimated Time**: 1 day  
**Location**: `packages/cli/src/lib/upgradeProcedures.ts:65`

**Reason**: Simple interface mismatch. The `options.logger.info` method is being called but the logger object structure doesn't match the expected interface. This is a straightforward fix requiring only updating the logger parameter passing or interface definition.

**What needs to be done**:
- Fix logger interface in upgradeRuntime function
- Ensure logger is properly passed through to sub-functions
- Add type safety to prevent future breaks

---

#### 2. Issue #479: Dev tests fail if port 10100 is being used
**Difficulty**: Easy  
**Estimated Time**: 1-2 days  
**Location**: `packages/cli/src/internal/commandParsers.ts:224`

**Reason**: The `getFreePort()` function calculates ports deterministically without checking availability. Simple fix using a port-checking library.

**What needs to be done**:
- Replace current implementation with `get-port` or `portfinder` library
- Add port availability check before allocation
- Update tests to handle dynamic ports

---

### 🟡 MEDIUM (3-5 days)

#### 3. Issue #446: Expose runtime version and type to contexts
**Difficulty**: Medium  
**Estimated Time**: 3-4 days  
**Location**: `packages/cli/src/lib/handlers/devHandler.ts`, context creation sections

**Reason**: Requires adding new properties to context objects across multiple handler implementations. Well-defined scope but needs careful implementation across all foundation types.

**What needs to be done**:
- Add runtime version extraction logic
- Update all context interfaces (DevModeContext, ChopsticksContext, etc.)
- Implement getters in each handler
- Add tests for new functionality

---

#### 4. Issue #410: Skipping Tests take too much time
**Difficulty**: Medium  
**Estimated Time**: 4-5 days  
**Location**: `packages/cli/src/cmds/runTests.ts`

**Reason**: Current test pattern matching is too broad. Needs enhancement to support file-specific and test-specific patterns similar to pytest/jest.

**What needs to be done**:
- Enhance testNamePattern handling
- Add support for file path patterns
- Implement test-specific targeting (e.g., `file.ts::testName`)
- Update CLI argument parsing

---

#### 5. Issue #198: Add all eth precompiles to static config
**Difficulty**: Medium  
**Estimated Time**: 3 days  
**Location**: `packages/util/src/constants/smartContract.ts`

**Reason**: Straightforward addition of constants but requires research to ensure all precompiles are included correctly.

**What needs to be done**:
- Research all Ethereum precompiles including ripemd160
- Add to PRECOMPILES static configuration
- Document each precompile's purpose
- Add tests for new constants

---

### 🔴 HARD (1-2 weeks)

#### 6. Issue #393: Add Provider connection timeouts
**Difficulty**: Hard  
**Estimated Time**: 1-2 weeks  
**Location**: `packages/cli/src/internal/providerFactories.ts`

**Reason**: Requires wrapping all provider connection methods with timeout logic across 5 different client libraries. High risk of breaking existing functionality.

**What needs to be done**:
- Implement standardized timeout wrapper using existing `withTimeout` helper
- Apply to all provider types (polkadotJs, ethers, viem, web3, papi)
- Standardize error handling for timeout scenarios
- Extensive testing across all provider types

---

#### 7. Issue #411: Vitest VS Code extension compatibility
**Difficulty**: Hard  
**Estimated Time**: 1-2 weeks  
**Location**: `packages/cli/src/lib/runnerContext.ts`, vitest configuration

**Reason**: Complex integration with VSCode's test runner API. Requires deep understanding of both Moonwall's custom test runner and VSCode extension requirements.

**What needs to be done**:
- Research VSCode test adapter API
- Modify test discovery mechanism
- Implement test result reporting in VSCode-compatible format
- Handle custom Moonwall test contexts

---

#### 8. Issue #200: Change customDevRpcRequest to use direct RPC
**Difficulty**: Hard  
**Estimated Time**: 1 week  
**Location**: Multiple files using RPC functionality

**Reason**: Requires refactoring RPC handling across the codebase, with potential impact on existing functionality.

**What needs to be done**:
- Identify all uses of customDevRpcRequest
- Refactor to use direct RPC calls
- Ensure backward compatibility
- Update all affected tests

---

### ⚫ VERY HARD (2+ weeks)

#### 9. Issue #252: Add CLI command to create new environment
**Difficulty**: Very Hard  
**Estimated Time**: 2-3 weeks  
**Location**: CLI command structure, config generation

**Reason**: Major feature addition requiring new CLI commands, interactive prompts, and config file generation logic.

**What needs to be done**:
- Design new CLI command structure
- Implement interactive environment creation wizard
- Add config file generation and validation
- Create templates for different environment types
- Comprehensive documentation

---

#### 10. Issue #301: Improve Error Handling with Effect library
**Difficulty**: Very Hard  
**Estimated Time**: 3-4 weeks  
**Location**: Entire codebase

**Reason**: Architecture-wide refactoring to adopt Effect library patterns. High risk, requires careful migration strategy.

**What needs to be done**:
- Learn and understand Effect library patterns
- Create migration strategy
- Refactor error handling incrementally
- Update all error paths throughout codebase
- Extensive testing and documentation

---

#### 11. Issue #201: Create Optimized QueryStorage helpers
**Difficulty**: Very Hard  
**Estimated Time**: 2-3 weeks  
**Location**: New utility functions, storage query optimization

**Reason**: Complex performance optimization work requiring deep understanding of Substrate storage mechanics.

**What needs to be done**:
- Analyze current storage query patterns
- Design optimized batch query system
- Implement efficient pagination
- Handle edge cases and error scenarios
- Performance testing and benchmarking

---

#### 12. Issue #137: Investigate generating metadata blob
**Difficulty**: Very Hard  
**Estimated Time**: 3+ weeks  
**Location**: PolkadotJS integration, metadata handling

**Reason**: Requires deep integration with PolkadotJS internals and understanding of metadata caching strategies.

**What needs to be done**:
- Research PolkadotJS metadata structure
- Design caching mechanism
- Implement blob generation and injection
- Handle metadata versioning
- Test across different runtime versions

---

#### 13. Issue #268: How to debug moonwall issues
**Difficulty**: Very Hard  
**Estimated Time**: 2-3 weeks  
**Location**: Logging system, debugging infrastructure

**Reason**: Requires comprehensive logging and debugging system design, touching many parts of the codebase.

**What needs to be done**:
- Design structured logging system
- Implement debug modes and verbosity levels
- Add tracing capabilities
- Create debugging documentation
- Implement error context capture

---

## Recommendations for Implementation

### Start with Easy Issues
1. **Issue #477** (Logger fix) - Quick win, improves reliability
2. **Issue #479** (Port checking) - Prevents common CI/CD failures

### High-Impact Medium Issues
1. **Issue #410** (Test patterns) - Significantly improves developer experience
2. **Issue #446** (Runtime version) - Useful for many testing scenarios

### Strategic Hard Issues
1. **Issue #393** (Provider timeouts) - Critical for reliability
2. **Issue #411** (VSCode integration) - Major DX improvement

### Long-term Architecture Improvements
1. **Issue #301** (Effect library) - Consider incremental adoption
2. **Issue #201** (Storage optimization) - Plan as performance becomes critical

## Architecture Insights

The analysis revealed several architectural patterns that affect issue complexity:

1. **Provider Proliferation**: Supporting 5 different blockchain client libraries creates maintenance overhead
2. **Ad-hoc Context Building**: Test contexts are assembled dynamically, making extensions complex
3. **Inconsistent Error Handling**: Lack of standardized patterns makes reliability improvements difficult
4. **Deterministic Resource Allocation**: Current port allocation strategy is fragile for parallel execution

These architectural decisions significantly impact the difficulty of implementing certain features and should be considered when planning improvements.