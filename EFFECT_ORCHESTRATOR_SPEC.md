# Effect-Powered Test Orchestrator - Specification

**Project Name:** `regolith`

**Status:** Specification / Design Phase

---

## Executive Summary

Build a standalone Effect-powered test orchestrator for blockchain testing that provides **guaranteed resource cleanup** while maintaining a simple, plain TypeScript test API. 
This orchestrator will be a standalone test harness that spins up a blockchain network, performs tests and reports results. It needs to be able to scale to thousands of tests as efficiently as possible.

**Key Differentiator:** Tests are written in plain TypeScript with zero Effect syntax exposure. Effect is used exclusively in the orchestration layer for resource management and structured concurrency.

---

## Rationale

### The Problem with Current Approach (Vitest + Effect)

Moonwall test framework currently uses Vitest for test orchestration, which creates a fundamental architectural mismatch:

**The Temporal Gap Problem:**
```
beforeAll()           tests run           afterAll()
    |                     |                    |
    v                     v                    v
spawn node  -----> node must live -----> kill node
```

- Blockchain nodes must **outlive the function that spawns them** (from `beforeAll()` through all tests until `afterAll()`)
- Effect.Scope expects **continuous execution** within a single scope
- This forces manual cleanup patterns where cleanup functions are returned rather than automatically managed
- If `afterAll()` doesn't run (worker crash, timeout, interruption), resources leak

**Measured Impact at Moonbeam Scale:**
- **2-3% resource leak rate** (zombie processes, orphaned ports)
- **1-2% port conflict rate** causing CI failures
- **~10 manual interventions per year** for server cleanup
- **Reduced CI trust** leading to productivity loss (~$35K/year cost)

### Why a Standalone Orchestrator?

**Option 1: Refactor Moonwall in-place**
- ❌ High migration cost (must maintain backward compatibility during migration)
- ❌ Risk of breaking existing Moonwall users during transition
- ❌ Complex dual-orchestrator maintenance period

**Option 2: Build standalone orchestrator (SELECTED)**
- ✅ Clean slate implementation following Effect best practices
- ✅ No legacy code constraints
- ✅ Can be adopted by Moonwall when stable
- ✅ Could be used by other blockchain testing frameworks
- ✅ Simpler testing and validation (no Moonwall coupling)

### The Core Insight

**Effect.Scope is perfect for test orchestration IF the entire test execution is wrapped in a scope:**

```typescript
Effect.scoped(
  Effect.gen(function* () {
    // Spawn node with acquireRelease (automatic cleanup)
    const node = yield* Effect.acquireRelease(
      spawnNode(config),
      (node) => killNode(node)
    );

    // Run all tests
    const results = yield* runTests(node);

    return results;
    // Node automatically killed here, even on crashes!
  })
)
```

The solution is to **make Effect the orchestrator**, not a helper library.

---

## Top Requirements

### Functional Requirements

**FR1: Guaranteed Resource Cleanup**
- **MUST**: All spawned blockchain nodes are killed when test file execution completes
- **MUST**: Cleanup happens even on test failures, timeouts, or crashes
- **MUST**: Ports are released back to the pool after use
- **MUST**: Log streams are flushed and closed properly
- **Target**: 0% resource leak rate (vs 2-3% current)

**FR2: Plain TypeScript Test API**
- **MUST**: Test authors write plain TypeScript (no Effect syntax)
- **MUST**: Test API feels familiar (similar to Vitest/Jest/Mocha)
- **MUST**: No Effect types visible in test code
- **Example**:
```typescript
describeSuite({
  id: "D01",
  title: "Balance transfers",
  foundation: "dev",
  testCases: ({ it, context }) => {
    it({
      id: "T01",
      title: "should transfer tokens",
      test: async function () {
        const block = await context.createBlock();
        expect(block.number).toBeGreaterThan(0);
      }
    });
  }
});
```

**FR3: Parallel Test Execution with Bounded Concurrency**
- **MUST**: Support parallel execution of multiple test files
- **MUST**: Configurable concurrency limit (e.g., max 3 files simultaneously)
- **MUST**: No port conflicts between parallel tests
- **SHOULD**: Graceful handling when concurrency limit reached

**FR4: Multiple Blockchain Foundation Support**
- **MUST**: Support local dev nodes (like Moonbeam, Polkadot)
- **SHOULD**: Support Chopsticks (Substrate fork tool)
- **COULD**: Support Zombienet (multi-node networks)
- **COULD**: Support read-only mode (connect to existing chains)

**FR5: CI Integration**
- **MUST**: Generate TAP output for CI parsing
- **MUST**: Generate JUnit XML for GitLab/Jenkins integration
- **MUST**: Exit with code 0 on success, 1 on failures
- **SHOULD**: Console output with clear pass/fail summary

**FR6: Test Discovery**
- **MUST**: Discover test files via glob patterns (e.g., `**/*.test.ts`)
- **MUST**: Support include/exclude patterns
- **MUST**: Support pattern filtering via CLI (e.g., `--pattern "balances"`)
- **SHOULD**: Deterministic test execution order

### Non-Functional Requirements

**NFR1: Performance**
- **MUST**: Test execution time within 10% of Vitest baseline
- **TARGET**: Faster than Vitest due to better resource management

**NFR2: Reliability**
- **MUST**: 100% test result parity with equivalent Vitest setup
- **MUST**: No flaky test execution (deterministic behavior)
- **TARGET**: Improved reliability over Vitest (no resource leaks)

**NFR3: Maintainability**
- **MUST**: Clear separation between orchestrator layer (Effect) and test API (plain TypeScript)
- **MUST**: Comprehensive unit tests for all Effect services
- **SHOULD**: Integration tests for end-to-end scenarios

**NFR4: Documentation**
- **MUST**: Complete API documentation for test authors
- **MUST**: Migration guide from Vitest
- **SHOULD**: Architecture documentation for contributors

---

## Tech Stack

### Core Framework

**Effect-ts** (v3.x)
- **Purpose**: Orchestration layer, resource management, structured concurrency
- **Why**: Built-in resource cleanup (Effect.Scope), typed errors, composable programs
- **Components used**:
  - `Effect.scoped` - automatic resource cleanup
  - `Effect.acquireRelease` - guaranteed cleanup pattern
  - `Effect.Semaphore` - bounded parallelism
  - `Effect.forEach` - structured concurrency
  - `Effect.Ref` - atomic state (port pool)
  - `Context.Tag` + `Layer` - service pattern

**TypeScript** (v5.x)
- **Purpose**: Implementation language
- **Why**: Type safety, Effect-ts requires TypeScript

**Node.js** (v20+)
- **Purpose**: Runtime
- **Why**: Child process spawning, filesystem operations

### Test File Discovery

**fast-glob** (v3.x)
- **Purpose**: Test file pattern matching
- **Why**: Same library used by Vite/Vitest, proven glob implementation
- **Alternative**: Could use Vitest's glob resolver if available as standalone library

### Reporter System

**tap-parser** (v15.x)
- **Purpose**: TAP output generation
- **Why**: Standard format for CI systems (Jenkins, CircleCI)

**junit-report-builder** (v3.x)
- **Purpose**: JUnit XML generation
- **Why**: GitLab CI, Jenkins XML parsing

### Process Management

**Node.js built-ins**
- `child_process` - spawn blockchain nodes
- `fs` - log file management
- `net` - port availability checking
- `ws` (WebSocket library) - RPC readiness checks

### Testing the Orchestrator

**Node.js native test runner** (`node:test`)
- **Purpose**: Unit tests for Effect services
- **Why**: No circular dependency on test frameworks (we're building a test framework!)
- **Alternative**: Could use Vitest for self-testing once stable

**Fixture-based integration tests**
- **Purpose**: End-to-end validation
- **Why**: Test against real blockchain node spawning

### CLI Framework

**yargs** (v17.x) OR **commander** (v11.x)
- **Purpose**: Command-line argument parsing
- **Why**: Standard CLI libraries, good TypeScript support

### Optional: Reusable from Moonwall

If building as separate package initially, could import these from Moonwall as peer dependencies:

**From `@moonwall/util`:**
- Logger utilities
- Test account generation (Alith, Baltathar, etc.)
- Transaction helper functions

**From `@moonwall/types`:**
- Type definitions for test contexts
- Configuration schemas

---

## Architecture Overview

### High-Level Structure

```
packages/
├── orchestrator/              # Core orchestration engine
│   ├── src/
│   │   ├── services/          # Effect services
│   │   │   ├── PortPoolService.ts
│   │   │   ├── ProcessManagerService.ts
│   │   │   ├── NodeReadinessService.ts
│   │   │   └── RpcPortDiscoveryService.ts
│   │   ├── execution/         # Test execution
│   │   │   ├── TestRegistry.ts
│   │   │   ├── executeTestFile.ts
│   │   │   ├── executeAllTestFiles.ts
│   │   │   └── runSingleTest.ts
│   │   ├── discovery/         # Test file discovery
│   │   │   └── discoverTestFiles.ts
│   │   ├── reporters/         # Output formats
│   │   │   ├── console.ts
│   │   │   ├── tap.ts
│   │   │   └── junit.ts
│   │   └── index.ts
│   └── package.json
├── test-api/                  # Public API for test authors
│   ├── src/
│   │   ├── describeSuite.ts   # Main test definition API
│   │   ├── context.ts         # Context types and builders
│   │   └── index.ts
│   └── package.json
├── cli/                       # Command-line interface
│   ├── src/
│   │   ├── commands/
│   │   │   ├── test.ts
│   │   │   └── run.ts
│   │   └── index.ts
│   └── package.json
└── examples/                  # Example test suites
    ├── basic-tests/
    ├── parallel-tests/
    └── fixtures/
```

### Data Flow

```
CLI Command
    |
    v
Load Configuration (JSON)
    |
    v
Discover Test Files (glob patterns)
    |
    v
Effect.forEach with Semaphore
    |
    +---> Test File 1 (Effect.scoped)
    |         |
    |         +---> Allocate Port
    |         +---> Spawn Node (acquireRelease)
    |         +---> Wait for Ready
    |         +---> Import Test File
    |         +---> Run Tests (TestRegistry)
    |         +---> [Scope closes - cleanup]
    |
    +---> Test File 2 (Effect.scoped)
    |         |
    |         +---> ... (same as above)
    |
    +---> Test File 3 (Effect.scoped)
              |
              +---> ... (same as above)
    |
    v
Aggregate Results
    |
    v
Generate Reports (TAP, JUnit, Console)
    |
    v
Exit (code 0 or 1)
```

---

## Configuration Schema

```typescript
interface OrchestratorConfig {
  // Test discovery
  testDir: string;                    // Base directory for tests
  include: string[];                  // Glob patterns to include
  exclude?: string[];                 // Glob patterns to exclude

  // Execution
  parallelism?: number;               // Max concurrent test files (default: 3)

  // Blockchain foundation
  foundation: {
    type: "dev" | "chopsticks" | "zombie" | "read_only";
    launchSpec: {
      binPath: string;                // Path to blockchain binary
      args?: string[];                // Additional CLI args
      logDirectory?: string;          // Custom log location
    }[];
  };

  // Blockchain client connections
  connections: {
    name: string;
    type: "polkadotJs" | "viem" | "ethers" | "web3" | "papi";
    endpoints: string[];              // RPC endpoints (supports {{MOONWALL_RPC_PORT}})
  }[];

  // Reporting
  reporters?: Array<"console" | "tap" | "junit">;

  // Timeouts
  testTimeout?: number;               // Per-test timeout (default: 30s)
  hookTimeout?: number;               // Setup/teardown timeout
}
```

**Example Configuration:**

```json
{
  "name": "dev_test",
  "testDir": "./test",
  "include": ["**/*.test.ts"],
  "exclude": ["**/node_modules/**"],
  "parallelism": 3,
  "foundation": {
    "type": "dev",
    "launchSpec": [{
      "binPath": "./tmp/moonbeam",
      "args": ["--dev", "--sealing=manual"]
    }]
  },
  "connections": [{
    "name": "eth",
    "type": "viem",
    "endpoints": ["ws://127.0.0.1:{{MOONWALL_RPC_PORT}}"]
  }],
  "reporters": ["console", "junit"],
  "testTimeout": 30000
}
```

---

## Core Effect Services (Detailed)

### PortPoolService

**Purpose:** Centralized port allocation to prevent conflicts

**Effect Primitives:**
- `Effect.Ref` - atomic mutable state
- `Ref.modify` - atomic read-modify-write
- `Context.Tag` + `Layer.effect` - service pattern

**Interface:**
```typescript
class PortPool extends Context.Tag("PortPool")<
  PortPool,
  {
    allocate: Effect.Effect<number, PortExhaustedError>;
    release: (port: number) => Effect.Effect<void>;
  }
>() {}
```

**Behavior:**
- Manages pool of 100 ports (8000-8100)
- Atomic allocation (thread-safe for concurrent requests)
- Fails with `PortExhaustedError` when pool empty
- Release returns port to pool

### ProcessManagerService

**Purpose:** Spawn and manage child processes with automatic log streaming

**Effect Primitives:**
- `Effect.acquireRelease` - guaranteed cleanup
- `Effect.tryPromise` - async operation wrapping
- `Effect.sync` - synchronous effect creation

**Interface:**
```typescript
class ProcessManager extends Context.Tag("ProcessManager")<
  ProcessManager,
  {
    launch: (config: ProcessConfig) => Effect.Effect<
      { process: ChildProcess; logPath: string },
      NodeLaunchError | ProcessError
    >;
  }
>() {}
```

**Behavior:**
- Spawns child process via `child_process.spawn`
- Creates log file stream for stdout/stderr
- Attaches exit handler for graceful termination messages
- Returns process handle and log path

### NodeReadinessService

**Purpose:** Poll blockchain node until RPC endpoints are ready

**Effect Primitives:**
- `Effect.retry` - automatic retries with exponential backoff
- `Effect.timeout` - bounded waiting
- `Schedule.exponential` - backoff strategy

**Interface:**
```typescript
class NodeReadiness extends Context.Tag("NodeReadiness")<
  NodeReadiness,
  {
    waitForReady: (port: number, timeout?: number) => Effect.Effect<
      void,
      ReadinessTimeoutError
    >;
  }
>() {}
```

**Behavior:**
- Polls WebSocket endpoint via `ws` library
- Checks both `system_chain` (Substrate) and `eth_chainId` (Ethereum) methods
- Retries with exponential backoff (100ms, 200ms, 400ms, ...)
- Fails after timeout (default: 30s)

### RpcPortDiscoveryService

**Purpose:** Discover dynamic RPC port from spawned node

**Effect Primitives:**
- `Effect.retry` - automatic retries
- `Effect.tryPromise` - wrap async operations

**Interface:**
```typescript
class RpcPortDiscovery extends Context.Tag("RpcPortDiscovery")<
  RpcPortDiscovery,
  {
    discover: (pid: number) => Effect.Effect<
      number,
      PortDiscoveryError
    >;
  }
>() {}
```

**Behavior:**
- Reads node's stdout/stderr for port announcement
- Retries if port not yet announced
- Falls back to default port if not discoverable

---

## Test API (Public Interface)

### describeSuite

**Purpose:** Define a test suite with automatic resource management

**Signature:**
```typescript
function describeSuite<T extends FoundationType>(options: {
  id: string;                         // Unique suite ID (e.g., "D01")
  title: string;                      // Human-readable title
  foundation: T;                      // Foundation type
  testCases: (helpers: {
    it: (testCase: TestCase) => void;
    context: ContextForFoundation<T>;
    log: (message: string) => void;
    logger: Logger;
  }) => void;

  // Optional filters
  minRtVersion?: number;              // Skip if runtime < version
  chainType?: string;                 // Only run on specific chain
  notChainType?: string;              // Skip on specific chain
}): void;
```

**Example Usage:**
```typescript
describeSuite({
  id: "D01",
  title: "Balance transfers",
  foundation: "dev",
  testCases: ({ it, context, log }) => {
    it({
      id: "T01",
      title: "should transfer 100 tokens",
      test: async function () {
        const balanceBefore = await context.viem().getBalance({ address: ALITH });

        await context.createBlock([
          context.createTxn({
            to: BALTATHAR,
            value: parseEther("100")
          })
        ]);

        const balanceAfter = await context.viem().getBalance({ address: ALITH });
        expect(balanceAfter).toBe(balanceBefore - parseEther("100"));
      }
    });
  }
});
```

### Context Object

**Purpose:** Provide blockchain interaction methods to tests

**Dev Foundation Context:**
```typescript
interface DevModeContext {
  // Blockchain clients
  polkadotJs: () => ApiPromise;
  viem: () => ViemClient;
  ethers: () => Wallet;
  web3: () => Web3;
  papi: () => PolkadotClient;

  // Dev mode helpers
  createBlock: (
    transactions?: Transaction[],
    options?: BlockCreation
  ) => Promise<Block>;

  createTxn: (options: TransactionOptions) => Transaction;

  // Time manipulation
  jumpBlocks: (n: number) => Promise<void>;
  jumpRounds: (n: number) => Promise<void>;

  // Introspection
  isEthereumChain: boolean;
  isSubstrateChain: boolean;

  // Accounts
  keyring: {
    alice: KeyringPair;
    bob: KeyringPair;
    charlie: KeyringPair;
    dave: KeyringPair;
  };
}
```

**Key Design Principle:** All methods return Promises (plain async), not Effects. Effect is hidden.

---

## CLI Interface

### Commands

**test** - Run tests for a specific environment

```bash
orchestrator test <config-file> [options]

Options:
  --pattern <pattern>     Filter test files by pattern
  --reporter <format>     Output format (console, tap, junit)
  --parallel <n>          Max concurrent test files (default: 3)
  --timeout <ms>          Global test timeout
```

**Example:**
```bash
orchestrator test dev.config.json --pattern "balances" --reporter junit
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed
- `2` - Configuration error
- `3` - No tests found

---

## Success Metrics

### Resource Management
- **Target:** 0% resource leak rate
- **Measure:** No zombie processes after test run completion
- **Verify:** `ps aux | grep moonbeam` returns empty after orchestrator exit

### Port Conflicts
- **Target:** 0% port conflict rate
- **Measure:** No "port already in use" errors during parallel execution
- **Verify:** `lsof -i :8000-8100` returns empty after orchestrator exit

### Test Result Parity
- **Target:** 100% same results as Vitest baseline
- **Measure:** Same pass/fail status for each test
- **Verify:** Compare TAP output between Vitest and orchestrator

### Performance
- **Target:** Within 10% of Vitest execution time
- **Measure:** Total wall-clock time for full test suite
- **Verify:** Benchmark across multiple runs

---

## Development Phases

### Phase 1: Core Engine (Standalone Proof of Concept)
- Implement PortPoolService
- Implement ProcessManagerService
- Implement executeTestFile (single file execution)
- Unit tests for all services
- **Success Criteria:** Can spawn node, run 1 test, cleanup guaranteed

### Phase 2: Orchestration Layer
- Implement executeAllTestFiles (parallel execution)
- Implement test file discovery
- Implement result aggregation
- **Success Criteria:** Can run 10 test files in parallel, no port conflicts

### Phase 3: Test API
- Implement describeSuite wrapper
- Implement context injection
- Implement compatibility layer
- **Success Criteria:** Existing Moonwall tests run without changes

### Phase 4: Reporting & CLI
- Implement console reporter
- Implement TAP reporter
- Implement JUnit XML reporter
- Implement CLI commands
- **Success Criteria:** CI can parse output, exit codes correct

### Phase 5: Validation
- Run against Moonbeam test suite (1000s of tests)
- Measure resource leaks, port conflicts, performance
- Compare results with Vitest baseline
- **Success Criteria:** 0% leaks, 0% conflicts, 100% parity, <10% slower

---

## Integration with Moonwall

Once stable, this orchestrator can be integrated into Moonwall via:

**Option A: Replace Vitest directly**
- Moonwall imports orchestrator as dependency
- Configuration mapped from `moonwall.config.json` to orchestrator config
- CLI delegates to orchestrator

**Option B: Parallel orchestrators**
- Moonwall supports both Vitest and Effect orchestrator
- Users choose via config: `testOrchestrator: "vitest" | "effect"`
- Gradual migration path

**Option C: Standalone tool**
- Keep as separate package
- Users can choose Moonwall (Vitest) or orchestrator (Effect)
- Lower coupling, more flexibility

---

## Open Questions

1. **Foundation Support Priority:**
   - Should we implement all 4 foundations (dev, chopsticks, zombie, read_only) in Phase 1, or focus on `dev` only initially?
   - **Recommendation:** Start with `dev` only for MVP, add others incrementally

2. **Testing Strategy:**
   - Use `node:test` for unit tests, but what about integration tests?
   - **Recommendation:** Fixture-based integration tests with mock blockchain nodes

3. **Package Naming:**
   - `moonbeam-test-orchestrator` vs `effect-test-orchestrator` vs `blockchain-test-orchestrator`?
   - **Recommendation:** Start with `moonbeam-test-orchestrator`, generalize later if needed

4. **Assertion Library:**
   - Should we bundle an assertion library (expect, chai) or let users choose?
   - **Recommendation:** Let users choose, provide examples for common libraries

5. **Watch Mode:**
   - Should we support watch mode (re-run tests on file changes)?
   - **Recommendation:** Phase 6 feature, not MVP

---

## References

- [Effect Documentation](https://effect.website/)
- [Effect Resource Management Guide](https://effect.website/docs/guides/resource-management)
- [Vitest Architecture](https://vitest.dev/advanced/runner.html)
- [Moonwall Repository](https://github.com/Moonsong-Labs/moonwall)
- [TAP Specification](https://testanything.org/)
- [JUnit XML Format](https://llg.cubic.org/docs/junit/)

---

## Conclusion

This specification defines a standalone Effect-powered test orchestrator that solves the resource leak problem while maintaining a simple test API. By building as a separate package, we avoid the complexity of refactoring Moonwall in-place and can validate the approach independently before integration.

**Next Steps:**
1. Set up new repository: `moonbeam-test-orchestrator`
2. Implement Phase 1: Core Engine
3. Validate with simple test fixtures
4. Expand to Phases 2-3 for Moonwall compatibility

**Key Success Factor:** Tests remain plain TypeScript. Effect is powerful but hidden.
